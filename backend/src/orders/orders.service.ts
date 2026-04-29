import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order, OrderStatus, PaymentStatus, PaymentMethodType } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ReturnRequest, ReturnStatus } from './entities/return-request.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../analytics/entities/stock-movement.entity';
import { StockAlert } from '../alerts/entities/stock-alert.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { PricingService } from '../promotions/pricing.service';
import { CreateOrderDto } from './dto/create-order.dto';

/**
 * Valid status transitions map.
 * Each key maps to the set of statuses it is allowed to transition to.
 */
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.PAYMENT_PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.PAYMENT_PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
    OrderStatus.FAILED,
  ],
  [OrderStatus.CONFIRMED]: [
    OrderStatus.PROCESSING,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.PROCESSING]: [
    OrderStatus.READY,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.READY]: [
    OrderStatus.SHIPPED,
    OrderStatus.PARTIALLY_SHIPPED,
    OrderStatus.CANCELLED,
  ],
  // Partial state set by the marketplace auto-promote when seller items have shipped
  // but the merchant still owes items. Merchant flow advances this to SHIPPED later.
  [OrderStatus.PARTIALLY_SHIPPED]: [
    OrderStatus.SHIPPED,
    OrderStatus.PARTIALLY_DELIVERED,
    OrderStatus.CANCELLED,
  ],
  [OrderStatus.SHIPPED]: [
    OrderStatus.IN_TRANSIT,
    OrderStatus.PARTIALLY_DELIVERED,
    OrderStatus.DELIVERED,
  ],
  [OrderStatus.IN_TRANSIT]: [
    OrderStatus.OUT_FOR_DELIVERY,
    OrderStatus.PARTIALLY_DELIVERED,
  ],
  [OrderStatus.OUT_FOR_DELIVERY]: [
    OrderStatus.DELIVERED,
    OrderStatus.PARTIALLY_DELIVERED,
  ],
  [OrderStatus.PARTIALLY_DELIVERED]: [
    OrderStatus.DELIVERED,
    OrderStatus.RETURNED,
  ],
  [OrderStatus.DELIVERED]: [
    OrderStatus.COMPLETED,
    OrderStatus.RETURNED,
  ],
  [OrderStatus.COMPLETED]: [
    OrderStatus.RETURNED,
  ],
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.RETURNED]: [
    OrderStatus.REFUNDED,
  ],
  [OrderStatus.REFUNDED]: [],
  [OrderStatus.FAILED]: [
    OrderStatus.PENDING,
  ],
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(OrderStatusHistory)
    private readonly statusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(StockMovement)
    private readonly stockMovRepo: Repository<StockMovement>,
    @InjectRepository(StockAlert)
    private readonly stockAlertRepo: Repository<StockAlert>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    private readonly pricingService: PricingService,
  ) {}

  /** Notify users subscribed to back-in-stock alerts when stock returns to positive. */
  private async notifyBackInStock(productId: number, prevStock: number, newStock: number): Promise<void> {
    if (prevStock > 0 || newStock <= 0) return; // only fire 0 → positive
    try {
      const subscribers = await this.stockAlertRepo.find({
        where: { product_id: productId, is_notified: false },
      });
      if (subscribers.length === 0) return;
      const product = await this.productRepo.findOne({ where: { id: productId } });
      const title = product?.title || `Produit #${productId}`;
      for (const sub of subscribers) {
        if (sub.user_id) {
          await this.notifRepo.save(this.notifRepo.create({
            user_id: sub.user_id,
            type: NotificationType.PRODUCT,
            title: `${title} est de retour !`,
            message: `L'article que vous attendiez est à nouveau disponible. Foncez avant rupture.`,
            action_url: `/detail-produit/${productId}`,
            is_read: false,
          }));
        }
        sub.is_notified = true;
        sub.notified_at = new Date();
        await this.stockAlertRepo.save(sub);
      }
      this.logger.log(`Back-in-stock notified ${subscribers.length} user(s) for product ${productId}`);
    } catch (err: any) {
      this.logger.warn(`Back-in-stock notify failed for product ${productId}: ${err.message}`);
    }
  }

  /**
   * Decrement product stock and log a StockMovement.
   * Never throws — stock issues are logged but don't block order creation.
   */
  private async decrementStock(
    productId: number,
    quantity: number,
    orderReference: string,
  ): Promise<void> {
    try {
      const product = await this.productRepo.findOne({ where: { id: productId } });
      if (!product) return;
      const prev = product.totalStock || 0;
      const next = Math.max(0, prev - quantity);
      product.totalStock = next;
      await this.productRepo.save(product);
      await this.stockMovRepo.save(
        this.stockMovRepo.create({
          product_id: productId,
          previous_stock: prev,
          new_stock: next,
          delta: next - prev,
          reason: 'ORDER',
          reference_id: orderReference,
          notes: `Commande ${orderReference}`,
        }),
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to decrement stock for product ${productId}: ${err.message}`,
      );
    }
  }

  /**
   * Generic stock increment with movement logging.
   */
  private async incrementStock(
    productId: number,
    quantity: number,
    reason: string,
    referenceId: string | null,
    notes: string | null,
  ): Promise<void> {
    try {
      const product = await this.productRepo.findOne({ where: { id: productId } });
      if (!product) return;
      const prev = product.totalStock || 0;
      const next = prev + quantity;
      product.totalStock = next;
      await this.productRepo.save(product);
      await this.stockMovRepo.save(
        this.stockMovRepo.create({
          product_id: productId,
          previous_stock: prev,
          new_stock: next,
          delta: quantity,
          reason,
          reference_id: referenceId,
          notes,
        }),
      );
      await this.notifyBackInStock(productId, prev, next);
    } catch (err: any) {
      this.logger.warn(
        `Failed to increment stock for product ${productId}: ${err.message}`,
      );
    }
  }

  /**
   * Increment product stock on return approval + log movement.
   */
  async restockFromReturn(
    productId: number,
    quantity: number,
    returnId: number,
  ): Promise<void> {
    try {
      const product = await this.productRepo.findOne({ where: { id: productId } });
      if (!product) return;
      const prev = product.totalStock || 0;
      const next = prev + quantity;
      product.totalStock = next;
      await this.productRepo.save(product);
      await this.stockMovRepo.save(
        this.stockMovRepo.create({
          product_id: productId,
          previous_stock: prev,
          new_stock: next,
          delta: quantity,
          reason: 'RETURN',
          reference_id: `RET-${returnId}`,
          notes: `Retour #${returnId} approuvé`,
        }),
      );
    } catch (err: any) {
      this.logger.warn(
        `Failed to restock product ${productId} from return ${returnId}: ${err.message}`,
      );
    }
  }

  /**
   * Generate a unique order reference: ORD-YYYYMMDD-XXXXX
   */
  generateReference(): string {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('');
    const randomPart = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();
    return `ORD-${datePart}-${randomPart}`;
  }

  /**
   * Create a new order from the DTO.
   */
  async createOrder(
    userId: number,
    dto: CreateOrderDto,
    meta?: { ip_address?: string; user_agent?: string },
  ): Promise<Order> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    // Calculate subtotal
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.unit_price * item.quantity,
      0,
    );

    // Apply active pricing rules (auto-discounts by category/famille/tag)
    let rulesDiscount = 0;
    let appliedRules: Array<{ ruleId: number; ruleName: string; discount: number }> = [];
    try {
      const pricingInput = dto.items
        .filter((i) => (i as any).product_id)
        .map((i) => ({
          productId: Number((i as any).product_id),
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
        }));
      if (pricingInput.length > 0) {
        const pricing = await this.pricingService.computeTotals(pricingInput);
        rulesDiscount = pricing.ruleDiscount || 0;
        appliedRules = pricing.rulesApplied || [];
        if (appliedRules.length > 0) {
          this.logger.log(
            `Auto-discount applied: ${appliedRules.map((r) => r.ruleName).join(', ')} = -${rulesDiscount} TND`,
          );
        }
      }
    } catch (err: any) {
      this.logger.warn(`Pricing rules computation failed: ${err.message}`);
    }

    // Shipping cost logic (simplified)
    const shippingAmount =
      dto.shipping_method === 'free' || dto.shipping_method === 'store' ? 0 : 7;

    // Determine payment method enum
    let paymentMethod: PaymentMethodType;
    const pmLower = (dto.payment_method || '').toLowerCase();
    if (pmLower === 'cod' || pmLower === 'cash_on_delivery') {
      paymentMethod = PaymentMethodType.COD;
    } else {
      paymentMethod = PaymentMethodType.CTP;
    }

    // Determine initial status based on payment method
    const initialStatus =
      paymentMethod === PaymentMethodType.COD
        ? OrderStatus.CONFIRMED
        : OrderStatus.PENDING;

    const initialPaymentStatus =
      paymentMethod === PaymentMethodType.COD
        ? PaymentStatus.PENDING
        : PaymentStatus.PENDING;

    const totalAmount = Math.max(0, subtotal - rulesDiscount + shippingAmount);

    const order = this.orderRepo.create({
      reference: this.generateReference(),
      user_id: userId,
      status: initialStatus,
      payment_status: initialPaymentStatus,
      subtotal,
      discount_amount: rulesDiscount,
      shipping_amount: shippingAmount,
      tax_amount: 0,
      total_amount: totalAmount,
      coupon_code: dto.coupon_code || null,
      shipping_address: dto.shipping_address,
      shipping_method: dto.shipping_method,
      payment_method: paymentMethod,
      customer_phone: dto.shipping_address?.phone || null,
      notes: dto.notes || null,
      ip_address: meta?.ip_address || null,
      user_agent: meta?.user_agent || null,
    });

    const savedOrder = await this.orderRepo.save(order);

    // Create order items
    const orderItems = dto.items.map((item) =>
      this.orderItemRepo.create({
        order_id: savedOrder.id,
        product_id: (item as any).product_id || null,
        sku: item.sku || null,
        title: item.title,
        unit_price: item.unit_price,
        quantity: item.quantity,
        variant_info: item.variant_info || null,
        image_url: item.image_url || null,
      }),
    );
    await this.orderItemRepo.save(orderItems);

    // Auto-log stock movement for each item that has a product_id
    for (const item of dto.items) {
      const pid = (item as any).product_id;
      if (pid) await this.decrementStock(Number(pid), Number(item.quantity), savedOrder.reference);
    }

    // Record initial status history
    await this.statusHistoryRepo.save(
      this.statusHistoryRepo.create({
        order_id: savedOrder.id,
        old_status: null,
        new_status: initialStatus,
        reason: 'Order created',
        changed_by: 'system',
      }),
    );

    this.logger.log(
      `Order ${savedOrder.reference} created for user ${userId} (${paymentMethod})`,
    );

    return this.getOrderById(savedOrder.id);
  }

  /**
   * Get paginated orders for a user. Optionally filter by status.
   */
  async getOrders(
    userId: number,
    page: number = 1,
    status?: string,
  ): Promise<{ orders: Order[]; total: number; page: number; pages: number }> {
    const take = 10;
    const skip = (page - 1) * take;

    const where: any = { user_id: userId };
    if (status) {
      where.status = status;
    }

    const [orders, total] = await this.orderRepo.findAndCount({
      where,
      relations: ['items'],
      order: { created_at: 'DESC' },
      take,
      skip,
    });

    return {
      orders,
      total,
      page,
      pages: Math.ceil(total / take),
    };
  }

  /**
   * Get a single order by ID, with all relations.
   */
  async getOrderById(id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['items', 'status_history', 'payments'],
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    return order;
  }

  /**
   * Update order status with transition validation.
   */
  async updateOrderStatus(
    id: number,
    newStatus: OrderStatus,
    reason?: string,
    changedBy?: string,
  ): Promise<Order> {
    const order = await this.getOrderById(id);
    const currentStatus = order.status as OrderStatus;

    const allowed = STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }

    const oldStatus = order.status;
    order.status = newStatus;

    // Set timestamps for specific transitions
    const now = new Date();
    if (newStatus === OrderStatus.CONFIRMED) {
      order.confirmed_at = now;
    } else if (newStatus === OrderStatus.SHIPPED) {
      order.shipped_at = now;
    } else if (newStatus === OrderStatus.DELIVERED) {
      order.delivered_at = now;
    } else if (newStatus === OrderStatus.CANCELLED) {
      order.cancelled_at = now;
      order.cancel_reason = reason || null;
    }

    await this.orderRepo.save(order);

    // Restore stock on cancellation (only if the order wasn't already cancelled before)
    if (newStatus === OrderStatus.CANCELLED && oldStatus !== OrderStatus.CANCELLED) {
      try {
        const items = await this.orderItemRepo.find({ where: { order_id: id } });
        for (const it of items) {
          if (it.product_id) {
            await this.incrementStock(
              it.product_id,
              it.quantity,
              'CANCELLATION',
              order.reference,
              `Annulation commande ${order.reference}`,
            );
          }
        }
      } catch (err: any) {
        this.logger.warn(`Stock restore on cancel failed for order ${id}: ${err.message}`);
      }
    }

    // Record status change
    await this.statusHistoryRepo.save(
      this.statusHistoryRepo.create({
        order_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        reason: reason || null,
        changed_by: changedBy || 'system',
      }),
    );

    this.logger.log(
      `Order #${id} status: ${oldStatus} -> ${newStatus}`,
    );

    return this.getOrderById(id);
  }

  /**
   * Cancel an order (only if status allows it).
   */
  async cancelOrder(id: number, reason?: string): Promise<Order> {
    return this.updateOrderStatus(
      id,
      OrderStatus.CANCELLED,
      reason || 'Customer requested cancellation',
      'customer',
    );
  }

  /**
   * Get tracking information for an order.
   */
  async getOrderTracking(id: number): Promise<{
    order_id: number;
    reference: string;
    status: string;
    tracking_number: string | null;
    history: OrderStatusHistory[];
    estimated_delivery?: string;
  }> {
    const order = await this.orderRepo.findOne({
      where: { id },
      relations: ['status_history'],
    });

    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }

    const history = await this.statusHistoryRepo.find({
      where: { order_id: id },
      order: { timestamp: 'ASC' },
    });

    return {
      order_id: order.id,
      reference: order.reference,
      status: order.status,
      tracking_number: order.tracking_number,
      history,
    };
  }
}
