import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, MoreThan, LessThan, In } from 'typeorm';

import { Order, OrderStatus, PaymentStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';
import { Coupon } from '../promotions/entities/coupon.entity';
import { ReturnRequest, ReturnStatus } from '../orders/entities/return-request.entity';
import { Banner } from './entities/banner.entity';
import { FAQ } from '../faq/entities/faq.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AdminLog } from '../analytics/entities/admin-log.entity';
import { StockMovement } from '../analytics/entities/stock-movement.entity';

import { DashboardPeriod } from './dto/dashboard.dto';
import { UpdateOrderStatusDto, CreateShipmentDto, ProcessRefundDto } from './dto/admin-orders.dto';
import { CreateCouponDto, UpdateCouponDto } from './dto/admin-coupons.dto';
import { AdminUpdateCustomerDto } from './dto/admin-customers.dto';
import { CreateBannerDto, UpdateBannerDto } from './dto/admin-content.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,

    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,

    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,

    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Coupon)
    private readonly couponRepo: Repository<Coupon>,

    @InjectRepository(ReturnRequest)
    private readonly returnRepo: Repository<ReturnRequest>,

    @InjectRepository(Banner)
    private readonly bannerRepo: Repository<Banner>,

    @InjectRepository(FAQ)
    private readonly faqRepo: Repository<FAQ>,

    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(AdminLog)
    private readonly adminLogRepo: Repository<AdminLog>,

    @InjectRepository(StockMovement)
    private readonly stockMovRepo: Repository<StockMovement>,
  ) {}

  /** Auto-restock products on return approval + log each movement. */
  private async restockFromReturn(returnRequest: ReturnRequest): Promise<void> {
    try {
      const items = Array.isArray(returnRequest.items) ? returnRequest.items : [];
      for (const it of items) {
        const pid = Number(it?.product_id || it?.productId);
        const qty = Number(it?.quantity) || 0;
        if (!pid || qty <= 0) continue;
        const product = await this.productRepo.findOne({ where: { id: pid } });
        if (!product) continue;
        const prev = product.totalStock || 0;
        const next = prev + qty;
        product.totalStock = next;
        await this.productRepo.save(product);
        await this.stockMovRepo.save(
          this.stockMovRepo.create({
            product_id: pid,
            previous_stock: prev,
            new_stock: next,
            delta: qty,
            reason: 'RETURN',
            reference_id: `RET-${returnRequest.id}`,
            notes: `Retour #${returnRequest.id} approuvé`,
          }),
        );
      }
    } catch (err: any) {
      this.logger.warn(`Failed to restock from return ${returnRequest.id}: ${err.message}`);
    }
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private getDateRange(period: DashboardPeriod): Date {
    const now = new Date();
    switch (period) {
      case DashboardPeriod.TODAY:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case DashboardPeriod.WEEK:
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return weekAgo;
      case DashboardPeriod.MONTH:
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return monthAgo;
      case DashboardPeriod.YEAR:
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return yearAgo;
      default:
        const defaultMonth = new Date(now);
        defaultMonth.setMonth(defaultMonth.getMonth() - 1);
        return defaultMonth;
    }
  }

  private async logAction(
    adminId: number,
    action: string,
    resourceType: string,
    resourceId?: string | number,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
  ): Promise<void> {
    try {
      await this.adminLogRepo.save({
        admin_id: adminId,
        action,
        resource_type: resourceType,
        resource_id: resourceId != null ? String(resourceId) : null,
        old_values: oldValues || null,
        new_values: newValues || null,
        timestamp: new Date(),
      });
    } catch (err) {
      this.logger.warn(`Failed to log admin action: ${err.message}`);
    }
  }

  // ─── Dashboard ──────────────────────────────────────────────────────

  async getDashboardStats(period: DashboardPeriod = DashboardPeriod.MONTH) {
    const startDate = this.getDateRange(period);

    const ordersQb = this.orderRepo.createQueryBuilder('o')
      .where('o.created_at >= :startDate', { startDate });

    const totalOrders = await ordersQb.getCount();

    const revenueResult = await this.orderRepo.createQueryBuilder('o')
      .select('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .where('o.created_at >= :startDate', { startDate })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED, OrderStatus.FAILED],
      })
      .getRawOne();
    const totalRevenue = parseFloat(revenueResult?.revenue || '0');

    const totalCustomers = await this.userRepo.createQueryBuilder('u')
      .where('u.role = :role', { role: 'CUSTOMER' })
      .getCount();

    const totalProducts = await this.productRepo.createQueryBuilder('p')
      .where('p.is_active = :active', { active: true })
      .getCount();

    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    const newCustomers = await this.userRepo.createQueryBuilder('u')
      .where('u.role = :role', { role: 'CUSTOMER' })
      .andWhere('u.created_at >= :startDate', { startDate })
      .getCount();

    const pendingOrders = await this.orderRepo.createQueryBuilder('o')
      .where('o.status IN (:...statuses)', {
        statuses: [OrderStatus.PENDING, OrderStatus.PAYMENT_PENDING],
      })
      .getCount();

    const processingOrders = await this.orderRepo.count({ where: { status: OrderStatus.PROCESSING } });
    const shippedOrders = await this.orderRepo.count({ where: { status: OrderStatus.SHIPPED } });
    const deliveredOrders = await this.orderRepo.count({ where: { status: OrderStatus.DELIVERED } });
    const cancelledOrders = await this.orderRepo.count({ where: { status: OrderStatus.CANCELLED } });

    const lowStockCount = await this.productRepo.createQueryBuilder('p')
      .where('p.is_active = :active', { active: true })
      .andWhere('p.total_stock > 0 AND p.total_stock < :threshold', { threshold: 10 })
      .getCount();
    const outOfStockCount = await this.productRepo.createQueryBuilder('p')
      .where('p.is_active = :active', { active: true })
      .andWhere('p.total_stock <= 0')
      .getCount();

    const pendingReturns = await this.returnRepo.count({ where: { status: ReturnStatus.PENDING } });

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
      },
      revenue: {
        total: Math.round(totalRevenue * 100) / 100,
        averageOrderValue: Math.round(avgOrderValue * 100) / 100,
        currency: 'TND',
      },
      customers: {
        total: totalCustomers,
        new: newCustomers,
      },
      products: {
        total: totalProducts,
        lowStock: lowStockCount,
        outOfStock: outOfStockCount,
      },
      returns: {
        pending: pendingReturns,
      },
      total_orders: totalOrders,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      total_customers: totalCustomers,
      total_products: totalProducts,
      avg_order_value: Math.round(avgOrderValue * 100) / 100,
      new_customers: newCustomers,
      pending_orders: pendingOrders,
      period,
    };
  }

  async getRecentOrders(limit: number = 10) {
    return this.orderRepo.find({
      relations: ['user'],
      order: { created_at: 'DESC' },
      take: limit,
      select: {
        id: true,
        reference: true,
        status: true,
        total_amount: true,
        payment_status: true,
        created_at: true,
        user: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
        },
      },
    });
  }

  async getLowStockAlerts(limit: number = 20) {
    return this.productRepo.createQueryBuilder('p')
      .select([
        'p.id',
        'p.title',
        'p.sku',
        'p.totalStock',
        'p.firstImageUrl',
      ])
      .where('p.is_active = :active', { active: true })
      .andWhere('p.total_stock < :threshold', { threshold: 10 })
      .orderBy('p.total_stock', 'ASC')
      .take(limit)
      .getMany();
  }

  async getRevenueChartData(period: DashboardPeriod = DashboardPeriod.MONTH) {
    const startDate = this.getDateRange(period);

    let groupBy: string;
    let dateFormat: string;
    if (period === DashboardPeriod.TODAY) {
      groupBy = "strftime('%H', o.created_at)";
      dateFormat = 'hour';
    } else if (period === DashboardPeriod.WEEK || period === DashboardPeriod.MONTH) {
      groupBy = "strftime('%Y-%m-%d', o.created_at)";
      dateFormat = 'day';
    } else {
      groupBy = "strftime('%Y-%m', o.created_at)";
      dateFormat = 'month';
    }

    const results = await this.orderRepo
      .createQueryBuilder('o')
      .select(groupBy, 'label')
      .addSelect('COALESCE(SUM(o.total_amount), 0)', 'revenue')
      .addSelect('COUNT(*)', 'orders')
      .where('o.created_at >= :startDate', { startDate })
      .andWhere('o.status NOT IN (:...excluded)', {
        excluded: [OrderStatus.CANCELLED, OrderStatus.FAILED],
      })
      .groupBy(groupBy)
      .orderBy(groupBy, 'ASC')
      .getRawMany();

    return {
      period,
      date_format: dateFormat,
      data: results.map((r) => ({
        label: r.label,
        revenue: parseFloat(r.revenue || '0'),
        orders: parseInt(r.orders || '0', 10),
      })),
    };
  }

  async getCustomerMetrics(period: DashboardPeriod = DashboardPeriod.MONTH) {
    const startDate = this.getDateRange(period);

    const newCustomers = await this.userRepo.createQueryBuilder('u')
      .where('u.role = :role', { role: 'CUSTOMER' })
      .andWhere('u.created_at >= :startDate', { startDate })
      .getCount();

    const totalCustomers = await this.userRepo.createQueryBuilder('u')
      .where('u.role = :role', { role: 'CUSTOMER' })
      .getCount();

    const activeCustomersResult = await this.orderRepo
      .createQueryBuilder('o')
      .select('COUNT(DISTINCT o.user_id)', 'count')
      .where('o.created_at >= :startDate', { startDate })
      .getRawOne();

    return {
      new_customers: newCustomers,
      total_customers: totalCustomers,
      active_customers: parseInt(activeCustomersResult?.count || '0', 10),
      period,
    };
  }

  // ─── Orders ─────────────────────────────────────────────────────────

  async getAdminOrders(
    page: number = 1,
    limit: number = 20,
    status?: string,
    search?: string,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const qb = this.orderRepo.createQueryBuilder('o')
      .leftJoinAndSelect('o.user', 'u');

    if (status) {
      qb.andWhere('o.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(o.reference LIKE :search OR o.customer_email LIKE :search OR u.email LIKE :search OR u.first_name LIKE :search OR u.last_name LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const allowedSortFields = ['created_at', 'total_amount', 'status', 'reference'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    qb.orderBy(`o.${field}`, sortOrder);

    const total = await qb.getCount();
    const orders = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: orders, pages: Math.ceil(total / limit), total, page, limit, data: orders, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async getAdminOrder(id: number) {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['user', 'items', 'status_history'],
    });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  async updateOrderStatus(
    id: number,
    dto: UpdateOrderStatusDto,
    adminId?: number,
  ) {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    const oldStatus = order.status;
    order.status = dto.status;

    // Update related timestamps
    const now = new Date();
    if (dto.status === OrderStatus.CONFIRMED) {
      order.confirmed_at = now;
    } else if (dto.status === OrderStatus.SHIPPED) {
      order.shipped_at = now;
    } else if (dto.status === OrderStatus.DELIVERED) {
      order.delivered_at = now;
    } else if (dto.status === OrderStatus.CANCELLED) {
      order.cancelled_at = now;
      if (dto.reason) {
        order.cancel_reason = dto.reason;
      }
    }

    await this.orderRepo.save(order);

    if (adminId) {
      await this.logAction(adminId, 'UPDATE_ORDER_STATUS', 'order', id, {
        status: oldStatus,
      }, {
        status: dto.status,
        reason: dto.reason,
      });
    }

    return order;
  }

  async createShipment(
    orderId: number,
    dto: CreateShipmentDto,
    adminId?: number,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    order.tracking_number = dto.tracking_number;
    order.shipping_method = dto.carrier;
    order.status = OrderStatus.SHIPPED;
    order.shipped_at = new Date();

    await this.orderRepo.save(order);

    if (adminId) {
      await this.logAction(adminId, 'CREATE_SHIPMENT', 'order', orderId, null, {
        tracking_number: dto.tracking_number,
        carrier: dto.carrier,
      });
    }

    return order;
  }

  async processRefund(
    orderId: number,
    dto: ProcessRefundDto,
    adminId?: number,
  ) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException(`Order #${orderId} not found`);
    }

    if (dto.amount > Number(order.total_amount)) {
      throw new BadRequestException('Refund amount exceeds order total');
    }

    const wasFullRefund = dto.amount >= Number(order.total_amount);
    if (wasFullRefund) {
      order.payment_status = PaymentStatus.REFUNDED;
      order.status = OrderStatus.REFUNDED;
    } else {
      order.payment_status = PaymentStatus.PARTIALLY_REFUNDED;
    }

    order.notes = order.notes
      ? `${order.notes}\n[REFUND] ${dto.reason} - Amount: ${dto.amount}`
      : `[REFUND] ${dto.reason} - Amount: ${dto.amount}`;

    await this.orderRepo.save(order);

    // Full refund triggers stock restoration for all line items with a product_id
    if (wasFullRefund) {
      try {
        const items = await this.orderItemRepo.find({ where: { order_id: orderId } });
        for (const it of items) {
          if (!it.product_id) continue;
          const product = await this.productRepo.findOne({ where: { id: it.product_id } });
          if (!product) continue;
          const prev = product.totalStock || 0;
          const next = prev + it.quantity;
          product.totalStock = next;
          await this.productRepo.save(product);
          await this.stockMovRepo.save(
            this.stockMovRepo.create({
              product_id: it.product_id,
              previous_stock: prev,
              new_stock: next,
              delta: it.quantity,
              reason: 'REFUND',
              reference_id: order.reference,
              notes: `Remboursement total ${order.reference}`,
            }),
          );
        }
      } catch (err: any) {
        this.logger.warn(`Stock restore on refund failed for order ${orderId}: ${err.message}`);
      }
    }

    if (adminId) {
      await this.logAction(adminId, 'PROCESS_REFUND', 'order', orderId, null, {
        amount: dto.amount,
        reason: dto.reason,
      });
    }

    return {
      order,
      refund: {
        amount: dto.amount,
        reason: dto.reason,
        processed_at: new Date(),
      },
    };
  }

  // ─── Products ───────────────────────────────────────────────────────

  async getAdminProducts(
    page: number = 1,
    limit: number = 20,
    search?: string,
    famille?: string,
    categoryId?: number,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    try {
      const qb = this.productRepo.createQueryBuilder('p');

      if (search) {
        qb.andWhere(
          '(p.title LIKE :search OR p.sku LIKE :search)',
          { search: `%${search}%` },
        );
      }

      if (famille) {
        qb.andWhere('p.famille = :famille', { famille });
      }

      const allowedSortFields = ['created_at', 'title', 'price', 'total_stock'];
      const field = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      qb.orderBy(`p.${field}`, sortOrder);

      const total = await qb.getCount();
      const products = await qb
        .skip((page - 1) * limit)
        .take(limit)
        .getMany();

    return { items: products, pages: Math.ceil(total / limit), total, page, limit, data: products, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
    } catch (error) {
      this.logger.error(`getAdminProducts error: ${error.message}`);
      return { items: [], pages: 0, total: 0, page, limit, data: [], meta: { total: 0, page, limit, total_pages: 0 } };
    }
  }

  async createProduct(dto: Partial<Product>, adminId?: number) {
    const product = this.productRepo.create(dto);
    const saved = await this.productRepo.save(product);

    if (adminId) {
      await this.logAction(adminId, 'CREATE_PRODUCT', 'product', saved.id, null, {
        title: saved.title,
      });
    }

    return saved;
  }

  async updateProduct(id: number, dto: Partial<Product>, adminId?: number) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    const oldValues = { title: product.title, price: product.price };
    Object.assign(product, dto);
    const saved = await this.productRepo.save(product);

    if (adminId) {
      await this.logAction(adminId, 'UPDATE_PRODUCT', 'product', id, oldValues, dto);
    }

    return saved;
  }

  async deleteProduct(id: number, adminId?: number) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    // Soft delete: deactivate the product
    product.isActive = false;
    await this.productRepo.save(product);

    if (adminId) {
      await this.logAction(adminId, 'DELETE_PRODUCT', 'product', id, null, {
        title: product.title,
      });
    }

    return { message: `Product #${id} has been deactivated` };
  }

  async updateProductInventory(
    id: number,
    variants: Array<{ id: number; stock: number }>,
    adminId?: number,
  ) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['variants'],
    });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }

    let totalStock = 0;

    for (const v of variants) {
      const variant = await this.variantRepo.findOne({ where: { id: v.id, productId: id } });
      if (variant) {
        variant.stock = v.stock;
        await this.variantRepo.save(variant);
        totalStock += v.stock;
      }
    }

    // Also update the product-level total_stock
    product.totalStock = totalStock;
    await this.productRepo.save(product);

    if (adminId) {
      await this.logAction(adminId, 'UPDATE_INVENTORY', 'product', id, null, { variants });
    }

    return this.productRepo.findOne({
      where: { id },
      relations: ['variants'],
    });
  }

  // ─── Customers ──────────────────────────────────────────────────────

  async getAdminCustomers(
    page: number = 1,
    limit: number = 20,
    search?: string,
    sortBy: string = 'created_at',
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ) {
    const qb = this.userRepo.createQueryBuilder('u');

    if (search) {
      qb.andWhere(
        '(u.email LIKE :search OR u.first_name LIKE :search OR u.last_name LIKE :search OR u.phone LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const allowedSortFields = ['created_at', 'email', 'first_name', 'last_name'];
    const field = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    qb.orderBy(`u.${field}`, sortOrder);

    const total = await qb.getCount();
    const customers = await qb
      .select([
        'u.id',
        'u.email',
        'u.first_name',
        'u.last_name',
        'u.phone',
        'u.role',
        'u.is_active',
        'u.is_verified',
        'u.last_login',
        'u.created_at',
      ])
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: customers, pages: Math.ceil(total / limit), total, page, limit, data: customers, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async getAdminCustomer(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['addresses', 'orders'],
    });
    if (!user) {
      throw new NotFoundException(`Customer #${id} not found`);
    }

    // Remove sensitive data
    const { password_hash, ...result } = user as any;
    return result;
  }

  async updateCustomer(id: number, dto: AdminUpdateCustomerDto, adminId?: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`Customer #${id} not found`);
    }

    const oldValues = {
      first_name: user.first_name,
      last_name: user.last_name,
      is_active: user.is_active,
      role: user.role,
    };

    Object.assign(user, dto);
    const saved = await this.userRepo.save(user);

    if (adminId) {
      await this.logAction(adminId, 'UPDATE_CUSTOMER', 'user', id, oldValues, dto);
    }

    const { password_hash, ...result } = saved as any;
    return result;
  }

  async addCustomerNote(userId: number, note: string, adminId?: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`Customer #${userId} not found`);
    }

    // Store note as a notification record linked to the user
    const notification = this.notificationRepo.create({
      user_id: userId,
      type: 'SYSTEM' as any,
      title: 'Admin Note',
      message: note,
      data: { added_by: adminId, type: 'admin_note' },
      is_read: false,
    });
    await this.notificationRepo.save(notification);

    if (adminId) {
      await this.logAction(adminId, 'ADD_CUSTOMER_NOTE', 'user', userId, null, { note });
    }

    return notification;
  }

  // ─── Coupons ────────────────────────────────────────────────────────

  async getAdminCoupons(
    page: number = 1,
    limit: number = 20,
    search?: string,
  ) {
    const qb = this.couponRepo.createQueryBuilder('c');

    if (search) {
      qb.andWhere('(c.code LIKE :search OR c.description LIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('c.created_at', 'DESC');

    const total = await qb.getCount();
    const coupons = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: coupons, pages: Math.ceil(total / limit), total, page, limit, data: coupons, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async createCoupon(dto: CreateCouponDto, adminId?: number) {
    const existing = await this.couponRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new BadRequestException(`Coupon code "${dto.code}" already exists`);
    }

    const coupon = this.couponRepo.create({
      code: dto.code,
      description: dto.description,
      discount_type: dto.type as any,
      discount_value: dto.value,
      min_purchase: dto.min_order_amount,
      max_discount: dto.max_discount,
      usage_limit: dto.usage_limit,
      per_user_limit: dto.per_user_limit ?? 1,
      is_active: dto.is_active ?? true,
      valid_from: dto.start_date ? new Date(dto.start_date) : new Date(),
      valid_to: dto.end_date
        ? new Date(dto.end_date)
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const saved = await this.couponRepo.save(coupon);

    if (adminId) {
      await this.logAction(adminId, 'CREATE_COUPON', 'coupon', saved.id, null, {
        code: saved.code,
      });
    }

    return saved;
  }

  async updateCoupon(id: number, dto: UpdateCouponDto, adminId?: number) {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon #${id} not found`);
    }

    const updateData: Partial<Coupon> = {};
    if (dto.code !== undefined) updateData.code = dto.code;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.type !== undefined) updateData.discount_type = dto.type as any;
    if (dto.value !== undefined) updateData.discount_value = dto.value;
    if (dto.min_order_amount !== undefined) updateData.min_purchase = dto.min_order_amount;
    if (dto.max_discount !== undefined) updateData.max_discount = dto.max_discount;
    if (dto.usage_limit !== undefined) updateData.usage_limit = dto.usage_limit;
    if (dto.per_user_limit !== undefined) updateData.per_user_limit = dto.per_user_limit;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
    if (dto.start_date !== undefined) updateData.valid_from = new Date(dto.start_date);
    if (dto.end_date !== undefined) updateData.valid_to = new Date(dto.end_date);

    Object.assign(coupon, updateData);
    const saved = await this.couponRepo.save(coupon);

    if (adminId) {
      await this.logAction(adminId, 'UPDATE_COUPON', 'coupon', id, null, dto);
    }

    return saved;
  }

  async deleteCoupon(id: number, adminId?: number) {
    const coupon = await this.couponRepo.findOne({ where: { id } });
    if (!coupon) {
      throw new NotFoundException(`Coupon #${id} not found`);
    }

    await this.couponRepo.remove(coupon);

    if (adminId) {
      await this.logAction(adminId, 'DELETE_COUPON', 'coupon', id, {
        code: coupon.code,
      }, null);
    }

    return { message: `Coupon #${id} deleted successfully` };
  }

  // ─── Returns ────────────────────────────────────────────────────────

  async getAdminReturns(
    page: number = 1,
    limit: number = 20,
    status?: string,
  ) {
    const qb = this.returnRepo.createQueryBuilder('r');

    if (status) {
      qb.andWhere('r.status = :status', { status });
    }

    qb.orderBy('r.created_at', 'DESC');

    const total = await qb.getCount();
    const returns = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { items: returns, pages: Math.ceil(total / limit), total, page, limit, data: returns, meta: { total, page, limit, total_pages: Math.ceil(total / limit) } };
  }

  async getAdminReturn(id: number) {
    const returnRequest = await this.returnRepo.findOne({ where: { id } });
    if (!returnRequest) {
      throw new NotFoundException(`Return request #${id} not found`);
    }

    // Fetch associated order
    const order = await this.orderRepo.findOne({
      where: { id: returnRequest.order_id },
      relations: ['user', 'items'],
    });

    return {
      ...returnRequest,
      order,
    };
  }

  async approveReturn(id: number, adminNote?: string, refundAmount?: number, adminId?: number) {
    const returnRequest = await this.returnRepo.findOne({ where: { id } });
    if (!returnRequest) {
      throw new NotFoundException(`Return request #${id} not found`);
    }

    returnRequest.status = ReturnStatus.APPROVED;
    if (adminNote) {
      returnRequest.admin_notes = adminNote;
    }
    if (refundAmount !== undefined) {
      returnRequest.refund_amount = refundAmount;
    }
    returnRequest.resolved_at = new Date();

    await this.returnRepo.save(returnRequest);

    // Auto-restock on return approval
    await this.restockFromReturn(returnRequest);

    if (adminId) {
      await this.logAction(adminId, 'APPROVE_RETURN', 'return_request', id, null, {
        admin_note: adminNote,
        refund_amount: refundAmount,
      });
    }

    return returnRequest;
  }

  async rejectReturn(id: number, reason: string, adminId?: number) {
    const returnRequest = await this.returnRepo.findOne({ where: { id } });
    if (!returnRequest) {
      throw new NotFoundException(`Return request #${id} not found`);
    }

    returnRequest.status = ReturnStatus.REJECTED;
    returnRequest.admin_notes = reason;
    returnRequest.resolved_at = new Date();

    await this.returnRepo.save(returnRequest);

    if (adminId) {
      await this.logAction(adminId, 'REJECT_RETURN', 'return_request', id, null, { reason });
    }

    return returnRequest;
  }

  // ─── Content: Banners ───────────────────────────────────────────────

  async getBanners() {
    return this.bannerRepo.find({
      order: { sort_order: 'ASC', created_at: 'DESC' },
    });
  }

  async createBanner(dto: CreateBannerDto, adminId?: number) {
    const banner = this.bannerRepo.create({
      title: dto.title,
      subtitle: dto.subtitle,
      image_url: dto.image_url,
      link_url: dto.link_url,
      position: dto.position,
      sort_order: dto.sort_order ?? 0,
      is_active: dto.is_active ?? true,
      start_date: dto.start_date ? new Date(dto.start_date) : null,
      end_date: dto.end_date ? new Date(dto.end_date) : null,
    });

    const saved = await this.bannerRepo.save(banner);

    if (adminId) {
      await this.logAction(adminId, 'CREATE_BANNER', 'banner', saved.id, null, {
        title: saved.title,
      });
    }

    return saved;
  }

  async updateBanner(id: number, dto: UpdateBannerDto, adminId?: number) {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner #${id} not found`);
    }

    if (dto.title !== undefined) banner.title = dto.title;
    if (dto.subtitle !== undefined) banner.subtitle = dto.subtitle;
    if (dto.image_url !== undefined) banner.image_url = dto.image_url;
    if (dto.link_url !== undefined) banner.link_url = dto.link_url;
    if (dto.position !== undefined) banner.position = dto.position;
    if (dto.sort_order !== undefined) banner.sort_order = dto.sort_order;
    if (dto.is_active !== undefined) banner.is_active = dto.is_active;
    if (dto.start_date !== undefined) banner.start_date = new Date(dto.start_date);
    if (dto.end_date !== undefined) banner.end_date = new Date(dto.end_date);

    const saved = await this.bannerRepo.save(banner);

    if (adminId) {
      await this.logAction(adminId, 'UPDATE_BANNER', 'banner', id, null, dto);
    }

    return saved;
  }

  async deleteBanner(id: number, adminId?: number) {
    const banner = await this.bannerRepo.findOne({ where: { id } });
    if (!banner) {
      throw new NotFoundException(`Banner #${id} not found`);
    }

    await this.bannerRepo.remove(banner);

    if (adminId) {
      await this.logAction(adminId, 'DELETE_BANNER', 'banner', id, {
        title: banner.title,
      }, null);
    }

    return { message: `Banner #${id} deleted successfully` };
  }
}
