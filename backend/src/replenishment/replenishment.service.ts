import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import { Supplier } from './entities/supplier.entity';
import { ProductSupplier } from './entities/product-supplier.entity';
import { PurchaseOrder, PurchaseOrderStatus } from './entities/purchase-order.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { EventBusService } from '../platform/events/event-bus.service';

export interface ForecastRow {
  productId: number;
  sku?: string;
  title: string;
  currentStock: number;
  sold30d: number;
  dailyRate: number;
  daysLeft: number;
  reorderQty: number;
  supplierId: number | null;
  supplierName: string | null;
  unitCost: number;
  risk: 'CRITICAL' | 'HIGH' | 'MEDIUM';
}

@Injectable()
export class ReplenishmentService {
  private readonly logger = new Logger(ReplenishmentService.name);

  constructor(
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(ProductSupplier) private readonly psRepo: Repository<ProductSupplier>,
    @InjectRepository(PurchaseOrder) private readonly poRepo: Repository<PurchaseOrder>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    private readonly eventBus: EventBusService,
  ) {}

  // ═══ Supplier CRUD ═════════════════════════════════════════════════════

  listSuppliers() { return this.supplierRepo.find({ order: { name: 'ASC' } }); }

  async createSupplier(data: Partial<Supplier>) {
    if (!data.code || !data.name) throw new BadRequestException();
    return this.supplierRepo.save(this.supplierRepo.create({
      code: data.code.toUpperCase(),
      name: data.name,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      address: data.address || null,
      lead_time_days: data.lead_time_days ?? 14,
      min_order_qty: data.min_order_qty ?? 1,
      is_active: data.is_active !== false,
    }));
  }

  async updateSupplier(id: number, patch: Partial<Supplier>) {
    const s = await this.supplierRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    Object.assign(s, patch);
    return this.supplierRepo.save(s);
  }

  async setProductSupplier(productId: number, supplierId: number, unitCost: number, isPrimary = true) {
    let row = await this.psRepo.findOne({ where: { product_id: productId, supplier_id: supplierId } });
    if (!row) row = this.psRepo.create({ product_id: productId, supplier_id: supplierId, unit_cost: unitCost, is_primary: isPrimary });
    else { row.unit_cost = unitCost; row.is_primary = isPrimary; }
    if (isPrimary) {
      // Unset primary on other supplier rows for this product
      await this.psRepo.createQueryBuilder().update(ProductSupplier).set({ is_primary: false })
        .where('product_id = :p AND supplier_id != :s', { p: productId, s: supplierId }).execute();
    }
    return this.psRepo.save(row);
  }

  // ═══ Forecast (extension of wave4 stockout) ═══════════════════════════

  async forecast(leadDays = 14): Promise<ForecastRow[]> {
    const products = await this.productRepo.find({ where: { isActive: true } as any });
    const since = new Date(Date.now() - 30 * 86400000);

    const rows: ForecastRow[] = [];
    for (const p of products) {
      const sold = await this.orderRepo
        .createQueryBuilder('o')
        .innerJoin('order_items', 'oi', 'oi.order_id = o.id')
        .where('oi.product_id = :pid', { pid: p.id })
        .andWhere('o.created_at >= :s', { s: since })
        .andWhere("o.status NOT IN ('cancelled','failed','CANCELLED','FAILED')")
        .select('SUM(oi.quantity)', 'q')
        .getRawOne();
      const sold30 = Number(sold?.q || 0);
      if (sold30 === 0) continue;

      const stock = Number((p as any).totalStock || 0);
      const dailyRate = sold30 / 30;
      const daysLeft = dailyRate > 0 ? stock / dailyRate : 999;
      if (daysLeft > leadDays + 14) continue;

      // Pick primary supplier for this product
      const supplierMap = await this.psRepo.findOne({ where: { product_id: p.id, is_primary: true } });
      const supplier = supplierMap ? await this.supplierRepo.findOne({ where: { id: supplierMap.supplier_id } }) : null;

      // Reorder qty = (lead time + 14d safety) * dailyRate, rounded up to MOQ
      const targetCover = Math.max(7, leadDays + 14);
      let reorderQty = Math.ceil(targetCover * dailyRate);
      const moq = supplier?.min_order_qty || supplierMap?.min_order_qty || 1;
      if (reorderQty < moq) reorderQty = moq;

      const risk: 'CRITICAL' | 'HIGH' | 'MEDIUM' =
        daysLeft < leadDays ? 'CRITICAL' : daysLeft < leadDays + 7 ? 'HIGH' : 'MEDIUM';

      rows.push({
        productId: p.id,
        sku: (p as any).sku,
        title: p.title,
        currentStock: stock,
        sold30d: sold30,
        dailyRate: Math.round(dailyRate * 100) / 100,
        daysLeft: Math.round(daysLeft),
        reorderQty,
        supplierId: supplier?.id || null,
        supplierName: supplier?.name || null,
        unitCost: Number(supplierMap?.unit_cost || 0),
        risk,
      });
    }

    rows.sort((a, b) => a.daysLeft - b.daysLeft);
    return rows;
  }

  // Generate PO drafts grouped by supplier from a forecast.
  async generatePODrafts(adminId: number, opts: { leadDays?: number; warehouseId?: number; risk?: 'CRITICAL' | 'HIGH' | 'MEDIUM' } = {}) {
    const forecast = await this.forecast(opts.leadDays || 14);
    const eligible = forecast.filter((f) => f.supplierId &&
      (opts.risk ? this.riskRank(f.risk) >= this.riskRank(opts.risk) : true));
    if (eligible.length === 0) return { created: 0, drafts: [] };

    const bySupplier = new Map<number, ForecastRow[]>();
    for (const f of eligible) {
      const arr = bySupplier.get(f.supplierId!) || [];
      arr.push(f);
      bySupplier.set(f.supplierId!, arr);
    }

    const drafts: PurchaseOrder[] = [];
    for (const [supplierId, items] of bySupplier.entries()) {
      const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
      if (!supplier) continue;
      const poItems = items.map((i) => ({
        productId: i.productId, sku: i.sku, title: i.title,
        quantity: i.reorderQty, unitCost: i.unitCost,
        lineTotal: Math.round(i.reorderQty * i.unitCost * 1000) / 1000,
      }));
      const subtotal = poItems.reduce((s, l) => s + l.lineTotal, 0);
      const ref = `PO-${Date.now().toString().slice(-8)}-${supplier.code}`;
      const po = this.poRepo.create({
        reference: ref,
        supplier_id: supplierId,
        warehouse_id: opts.warehouseId || null,
        items: poItems,
        subtotal,
        tax_amount: 0,
        total: subtotal,
        status: PurchaseOrderStatus.DRAFT,
        origin: 'AUTO',
        notes: `Auto-generated from forecast (lead ${opts.leadDays || 14}d, ${items.length} SKUs)`,
        expected_delivery: new Date(Date.now() + supplier.lead_time_days * 86400000),
        created_by: adminId,
      });
      drafts.push(await this.poRepo.save(po));
      this.eventBus.publish('po.draft_created', { poId: drafts[drafts.length - 1].id, supplierId, total: subtotal }, {
        aggregateId: `po:${drafts[drafts.length - 1].id}`, actorId: adminId,
      }).catch(() => {});
    }
    return { created: drafts.length, drafts };
  }

  private riskRank(r: string): number {
    return r === 'CRITICAL' ? 3 : r === 'HIGH' ? 2 : 1;
  }

  // ═══ PO lifecycle ═════════════════════════════════════════════════════

  listPOs(status?: string) {
    const qb = this.poRepo.createQueryBuilder('p').orderBy('p.created_at', 'DESC').take(500);
    if (status) qb.andWhere('p.status = :s', { s: status.toUpperCase() });
    return qb.getMany();
  }

  async approvePO(id: number, adminId: number) {
    const p = await this.poRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (p.status !== PurchaseOrderStatus.DRAFT) throw new BadRequestException('only DRAFT can be approved');
    p.status = PurchaseOrderStatus.APPROVED;
    await this.poRepo.save(p);
    this.eventBus.publish('po.approved', { poId: p.id, supplierId: p.supplier_id }, {
      aggregateId: `po:${p.id}`, actorId: adminId,
    }).catch(() => {});
    return p;
  }

  async sendPO(id: number, adminId: number) {
    const p = await this.poRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (p.status !== PurchaseOrderStatus.APPROVED) throw new BadRequestException('only APPROVED can be sent');
    p.status = PurchaseOrderStatus.SENT;
    p.sent_at = new Date();
    await this.poRepo.save(p);
    this.eventBus.publish('po.sent', { poId: p.id, supplierId: p.supplier_id }, {
      aggregateId: `po:${p.id}`, actorId: adminId,
    }).catch(() => {});
    return p;
  }

  // Mark received and bump stock back up.
  async receivePO(id: number, adminId: number) {
    const p = await this.poRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    if (p.status !== PurchaseOrderStatus.SENT && p.status !== PurchaseOrderStatus.APPROVED) {
      throw new BadRequestException('PO must be APPROVED or SENT before receiving');
    }
    p.status = PurchaseOrderStatus.RECEIVED;
    p.received_at = new Date();
    await this.poRepo.save(p);

    for (const it of (p.items || [])) {
      const prod = await this.productRepo.findOne({ where: { id: it.productId } });
      if (!prod) continue;
      (prod as any).totalStock = (Number((prod as any).totalStock) || 0) + Number(it.quantity || 0);
      await this.productRepo.save(prod);
      this.eventBus.publish('stock.adjusted', {
        productId: prod.id, delta: it.quantity, source: `po:${p.id}`,
      }, { aggregateId: `product:${prod.id}`, actorId: adminId }).catch(() => {});
    }

    this.eventBus.publish('po.received', { poId: p.id }, { aggregateId: `po:${p.id}`, actorId: adminId }).catch(() => {});
    return p;
  }

  async cancelPO(id: number, adminId: number, reason?: string) {
    const p = await this.poRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    p.status = PurchaseOrderStatus.CANCELLED;
    p.notes = [p.notes || '', `[CANCELLED] ${reason || 'admin'}`].filter(Boolean).join('\n');
    await this.poRepo.save(p);
    return p;
  }

  async stats() {
    const [draft, approved, sent, received, suppliers] = await Promise.all([
      this.poRepo.count({ where: { status: PurchaseOrderStatus.DRAFT } }),
      this.poRepo.count({ where: { status: PurchaseOrderStatus.APPROVED } }),
      this.poRepo.count({ where: { status: PurchaseOrderStatus.SENT } }),
      this.poRepo.count({ where: { status: PurchaseOrderStatus.RECEIVED } }),
      this.supplierRepo.count({ where: { is_active: true } }),
    ]);
    return { draft, approved, sent, received, suppliers };
  }
}
