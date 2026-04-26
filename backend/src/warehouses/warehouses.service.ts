import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Warehouse } from './entities/warehouse.entity';
import { ProductStock } from './entities/product-stock.entity';
import { Product } from '../products/entities/product.entity';

export interface StockSummary {
  productId: number;
  total: number;
  available: number;
  reserved: number;
  perWarehouse: Array<{
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    quantity: number;
    reserved: number;
    available: number;
    safetyStock: number;
    lowStock: boolean;
  }>;
}

@Injectable()
export class WarehousesService implements OnModuleInit {
  private readonly logger = new Logger(WarehousesService.name);

  constructor(
    @InjectRepository(Warehouse) private readonly whRepo: Repository<Warehouse>,
    @InjectRepository(ProductStock) private readonly stockRepo: Repository<ProductStock>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  // Seed the default warehouse on first boot if none exist, so the legacy flat
  // `Product.totalStock` behavior continues to work unchanged.
  async onModuleInit() {
    try {
      const count = await this.whRepo.count();
      if (count === 0) {
        const main = this.whRepo.create({
          code: 'MAIN',
          name: 'Entrepôt principal',
          city: 'Tunis',
          priority: 10,
          ships_orders: true,
          is_active: true,
          is_default: true,
        });
        await this.whRepo.save(main);
        this.logger.log(`Seeded default warehouse MAIN (id=${main.id})`);

        // Backfill product_stock from existing Product.totalStock
        const products = await this.productRepo.find({ select: ['id', 'totalStock'] });
        let seeded = 0;
        for (const p of products) {
          const existing = await this.stockRepo.findOne({ where: { product_id: p.id, warehouse_id: main.id } });
          if (!existing) {
            await this.stockRepo.save(this.stockRepo.create({
              product_id: p.id,
              warehouse_id: main.id,
              quantity: Math.max(0, Number(p.totalStock) || 0),
              reserved: 0,
              safety_stock: 0,
            }));
            seeded++;
          }
        }
        if (seeded > 0) this.logger.log(`Backfilled stock for ${seeded} products into MAIN warehouse`);
      }
    } catch (err) {
      this.logger.warn(`warehouse seed skipped: ${(err as any)?.message || err}`);
    }
  }

  // ═══ Warehouse CRUD ══════════════════════════════════════════════════

  listWarehouses() {
    return this.whRepo.find({ order: { priority: 'ASC', name: 'ASC' } });
  }

  async getWarehouse(id: number) {
    const w = await this.whRepo.findOne({ where: { id } });
    if (!w) throw new NotFoundException(`Warehouse ${id} not found`);
    return w;
  }

  async getDefault() {
    return (await this.whRepo.findOne({ where: { is_default: true, is_active: true } })) ||
      (await this.whRepo.findOne({ where: { is_active: true }, order: { priority: 'ASC' } }));
  }

  async createWarehouse(input: Partial<Warehouse>) {
    if (!input.code || !input.name) throw new BadRequestException('code + name requis');
    const code = input.code.toUpperCase();
    const existing = await this.whRepo.findOne({ where: { code } });
    if (existing) throw new BadRequestException(`Code ${code} déjà utilisé`);
    const w = this.whRepo.create({
      code,
      name: input.name,
      city: input.city || null,
      address: input.address || null,
      phone: input.phone || null,
      priority: input.priority ?? 100,
      ships_orders: input.ships_orders !== false,
      is_active: input.is_active !== false,
      is_default: false,
    });
    return this.whRepo.save(w);
  }

  async updateWarehouse(id: number, patch: Partial<Warehouse>) {
    const w = await this.getWarehouse(id);
    if (patch.code) patch.code = patch.code.toUpperCase();
    Object.assign(w, patch);
    return this.whRepo.save(w);
  }

  async setDefault(id: number) {
    const w = await this.getWarehouse(id);
    await this.whRepo.createQueryBuilder().update(Warehouse).set({ is_default: false }).execute();
    w.is_default = true;
    await this.whRepo.save(w);
    return w;
  }

  // ═══ Stock read ══════════════════════════════════════════════════════

  async getStockForProduct(productId: number): Promise<StockSummary> {
    const rows = await this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(Warehouse, 'w', 'w.id = s.warehouse_id')
      .select([
        's.id AS sid',
        's.warehouse_id AS warehouseId',
        's.quantity AS quantity',
        's.reserved AS reserved',
        's.safety_stock AS safetyStock',
        'w.code AS warehouseCode',
        'w.name AS warehouseName',
      ])
      .where('s.product_id = :pid', { pid: productId })
      .getRawMany();

    const perWarehouse = rows.map((r) => {
      const q = Number(r.quantity || 0);
      const res = Number(r.reserved || 0);
      const safety = Number(r.safetyStock || 0);
      return {
        warehouseId: Number(r.warehouseId),
        warehouseCode: r.warehouseCode,
        warehouseName: r.warehouseName,
        quantity: q,
        reserved: res,
        available: Math.max(0, q - res),
        safetyStock: safety,
        lowStock: q - res <= safety,
      };
    });
    const total = perWarehouse.reduce((s, x) => s + x.quantity, 0);
    const reserved = perWarehouse.reduce((s, x) => s + x.reserved, 0);
    const available = perWarehouse.reduce((s, x) => s + x.available, 0);
    return { productId, total, available, reserved, perWarehouse };
  }

  async adjust(productId: number, warehouseId: number, quantityDelta: number, safetyStock?: number) {
    await this.getWarehouse(warehouseId);
    let row = await this.stockRepo.findOne({ where: { product_id: productId, warehouse_id: warehouseId } });
    if (!row) {
      row = this.stockRepo.create({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: 0,
        reserved: 0,
        safety_stock: 0,
      });
    }
    row.quantity = Math.max(0, row.quantity + quantityDelta);
    if (safetyStock !== undefined) row.safety_stock = Math.max(0, safetyStock);
    const saved = await this.stockRepo.save(row);
    await this.recomputeProductTotal(productId);
    return saved;
  }

  async setStock(productId: number, warehouseId: number, absoluteQty: number, safetyStock?: number) {
    await this.getWarehouse(warehouseId);
    let row = await this.stockRepo.findOne({ where: { product_id: productId, warehouse_id: warehouseId } });
    if (!row) {
      row = this.stockRepo.create({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity: 0,
        reserved: 0,
        safety_stock: 0,
      });
    }
    row.quantity = Math.max(0, Math.floor(absoluteQty));
    if (safetyStock !== undefined) row.safety_stock = Math.max(0, safetyStock);
    const saved = await this.stockRepo.save(row);
    await this.recomputeProductTotal(productId);
    return saved;
  }

  // Keep legacy flat Product.totalStock in sync with the aggregated per-warehouse stock
  // so everything downstream (shop lists, AI grounding, catalog exports) keeps working.
  async recomputeProductTotal(productId: number): Promise<number> {
    const row = await this.stockRepo
      .createQueryBuilder('s')
      .select('SUM(s.quantity)', 'total')
      .where('s.product_id = :pid', { pid: productId })
      .getRawOne();
    const total = Math.max(0, Math.floor(Number(row?.total || 0)));
    await this.productRepo.update({ id: productId }, { totalStock: total });
    return total;
  }

  // Low-stock listing for the admin dashboard.
  async lowStock(limit = 50) {
    const rows = await this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(Warehouse, 'w', 'w.id = s.warehouse_id')
      .leftJoin(Product, 'p', 'p.id = s.product_id')
      .select([
        's.product_id AS productId',
        's.warehouse_id AS warehouseId',
        'p.sku AS sku',
        'p.title AS title',
        'w.code AS warehouseCode',
        'w.name AS warehouseName',
        's.quantity AS quantity',
        's.reserved AS reserved',
        's.safety_stock AS safetyStock',
      ])
      .where('s.quantity - s.reserved <= s.safety_stock')
      .andWhere('s.safety_stock > 0 OR s.quantity = 0')
      .orderBy('s.quantity', 'ASC')
      .limit(limit)
      .getRawMany();
    return rows.map((r) => ({
      productId: Number(r.productId),
      warehouseId: Number(r.warehouseId),
      sku: r.sku,
      title: r.title,
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      quantity: Number(r.quantity),
      reserved: Number(r.reserved),
      safetyStock: Number(r.safetyStock),
      available: Math.max(0, Number(r.quantity) - Number(r.reserved)),
    }));
  }

  // Stock summary for admin dashboard tiles.
  async globalStats() {
    const [warehouseCount, stockRows] = await Promise.all([
      this.whRepo.count({ where: { is_active: true } }),
      this.stockRepo.createQueryBuilder('s')
        .select('COUNT(1)', 'rows')
        .addSelect('SUM(s.quantity)', 'totalQty')
        .addSelect('SUM(s.reserved)', 'totalReserved')
        .addSelect('SUM(CASE WHEN s.quantity - s.reserved <= s.safety_stock AND (s.safety_stock > 0 OR s.quantity = 0) THEN 1 ELSE 0 END)', 'lowRows')
        .getRawOne(),
    ]);
    return {
      activeWarehouses: warehouseCount,
      stockLines: Number(stockRows?.rows || 0),
      totalUnits: Number(stockRows?.totalQty || 0),
      reservedUnits: Number(stockRows?.totalReserved || 0),
      lowStockLines: Number(stockRows?.lowRows || 0),
    };
  }
}
