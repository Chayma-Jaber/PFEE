import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Configurator } from './entities/configurator.entity';
import { ConfiguratorSlot } from './entities/configurator-slot.entity';
import { Product } from '../products/entities/product.entity';

export interface ConfiguratorFull {
  configurator: Configurator;
  slots: Array<ConfiguratorSlot & {
    pool: Array<{ productId: number; title: string; price: number; image: string | null }>;
  }>;
}

export interface PriceResult {
  configuratorId: number;
  lineItems: Array<{ productId: number; quantity: number; unitPrice: number; subtotal: number }>;
  subtotal: number;
  discountPct: number;
  discountAmount: number;
  total: number;
  missingSlots: number[];
  isComplete: boolean;
}

@Injectable()
export class ConfiguratorService {
  private readonly logger = new Logger(ConfiguratorService.name);

  constructor(
    @InjectRepository(Configurator) private readonly cfgRepo: Repository<Configurator>,
    @InjectRepository(ConfiguratorSlot) private readonly slotRepo: Repository<ConfiguratorSlot>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  // ═══ Public read ═══════════════════════════════════════════════════════

  async listActive() {
    return this.cfgRepo.find({ where: { is_active: true }, order: { id: 'DESC' } });
  }

  async getFull(slug: string): Promise<ConfiguratorFull> {
    const cfg = await this.cfgRepo.findOne({ where: { slug } });
    if (!cfg) throw new NotFoundException();
    const slots = await this.slotRepo.find({ where: { configurator_id: cfg.id }, order: { position: 'ASC' } });

    const out: ConfiguratorFull['slots'] = [];
    for (const slot of slots) {
      let poolIds: number[] = Array.isArray(slot.allowed_product_ids) && slot.allowed_product_ids.length > 0
        ? slot.allowed_product_ids
        : [];
      let products: Product[] = [];
      if (poolIds.length > 0) {
        products = await this.productRepo.find({ where: { id: In(poolIds) } });
      } else {
        const qb = this.productRepo.createQueryBuilder('p').where('p.is_active = :a', { a: true });
        if (slot.filter_category_id) qb.andWhere('p.category_id = :c', { c: slot.filter_category_id });
        if (slot.filter_famille) qb.andWhere('p.famille = :f', { f: slot.filter_famille });
        if (slot.filter_tag) qb.andWhere('p.tags LIKE :t', { t: `%${slot.filter_tag}%` });
        qb.orderBy('p.view_count', 'DESC').take(40);
        products = await qb.getMany();
      }
      out.push({
        ...slot,
        pool: products.map((p) => ({
          productId: p.id,
          title: p.title,
          price: Number((p as any).currentPrice || 0),
          image: (p as any).firstImageUrl || null,
        })),
      });
    }
    return { configurator: cfg, slots: out };
  }

  // ═══ Pricing ═══════════════════════════════════════════════════════════

  async price(cfgId: number, selection: Array<{ slotId: number; productId: number; quantity?: number }>): Promise<PriceResult> {
    const cfg = await this.cfgRepo.findOne({ where: { id: cfgId } });
    if (!cfg) throw new NotFoundException();
    const slots = await this.slotRepo.find({ where: { configurator_id: cfgId } });
    const slotById = new Map(slots.map((s) => [s.id, s]));

    const selectedSlotIds = new Set(selection.map((x) => x.slotId));
    const missingSlots: number[] = slots.filter((s) => s.required && !selectedSlotIds.has(s.id)).map((s) => s.id);

    const productIds = selection.map((x) => x.productId);
    const products = await this.productRepo.find({ where: { id: In(productIds) } });
    const byId = new Map(products.map((p) => [p.id, p]));

    const lineItems: PriceResult['lineItems'] = [];
    for (const sel of selection) {
      const slot = slotById.get(sel.slotId);
      if (!slot) throw new BadRequestException(`Unknown slot ${sel.slotId}`);
      const p = byId.get(sel.productId);
      if (!p) throw new BadRequestException(`Unknown product ${sel.productId}`);
      // Validate product is allowed in this slot
      if (slot.allowed_product_ids?.length && !slot.allowed_product_ids.includes(sel.productId)) {
        throw new BadRequestException(`Product ${sel.productId} not allowed in slot ${sel.slotId}`);
      }
      const qty = Math.max(1, Math.min(slot.max_items, Number(sel.quantity || 1)));
      const unit = Number((p as any).currentPrice || 0);
      lineItems.push({ productId: p.id, quantity: qty, unitPrice: unit, subtotal: unit * qty });
    }

    const subtotal = lineItems.reduce((s, l) => s + l.subtotal, 0);
    const isComplete = missingSlots.length === 0;
    const discountPct = isComplete ? cfg.bundle_discount_pct : 0;
    const discountAmount = Math.round(subtotal * discountPct / 100 * 1000) / 1000;
    const total = Math.max(0, subtotal - discountAmount);

    return { configuratorId: cfgId, lineItems, subtotal, discountPct, discountAmount, total, missingSlots, isComplete };
  }

  // ═══ Admin ═════════════════════════════════════════════════════════════

  async createConfigurator(data: Partial<Configurator>) {
    if (!data.slug || !data.title) throw new BadRequestException('slug + title requis');
    return this.cfgRepo.save(this.cfgRepo.create({
      slug: data.slug,
      title: data.title,
      description: data.description || null,
      cover_image: data.cover_image || null,
      bundle_discount_pct: data.bundle_discount_pct ?? 10,
      kind: data.kind || 'GIFT_BOX',
      is_active: data.is_active !== false,
    }));
  }

  async updateConfigurator(id: number, patch: Partial<Configurator>) {
    const c = await this.cfgRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException();
    Object.assign(c, patch);
    return this.cfgRepo.save(c);
  }

  listAll() { return this.cfgRepo.find({ order: { id: 'DESC' } }); }

  async addSlot(data: Partial<ConfiguratorSlot>) {
    if (!data.configurator_id || !data.name) throw new BadRequestException();
    return this.slotRepo.save(this.slotRepo.create({
      configurator_id: data.configurator_id,
      name: data.name,
      position: data.position ?? 0,
      required: data.required !== false,
      max_items: data.max_items ?? 1,
      allowed_product_ids: data.allowed_product_ids || null,
      filter_category_id: data.filter_category_id || null,
      filter_famille: data.filter_famille || null,
      filter_tag: data.filter_tag || null,
    }));
  }

  async removeSlot(id: number) { await this.slotRepo.delete({ id }); return { success: true }; }

  listSlotsFor(cfgId: number) {
    return this.slotRepo.find({ where: { configurator_id: cfgId }, order: { position: 'ASC' } });
  }
}
