import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { ProductReview } from '../reviews/entities/product-review.entity';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminCustomer360Controller {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(LoyaltyAccount) private readonly loyaltyRepo: Repository<LoyaltyAccount>,
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(ProductReview) private readonly reviewRepo: Repository<ProductReview>,
  ) {}

  @Get(':id/360')
  async getCustomer360(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Customer not found');

    // Orders with totals
    const orders = await this.orderRepo.find({
      where: { user_id: id },
      order: { created_at: 'DESC' },
      take: 50,
    });

    const totalSpent = orders
      .filter((o) => String(o.status).toLowerCase() !== 'cancelled' && String(o.status).toLowerCase() !== 'failed')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0);

    const avgOrderValue = orders.length > 0 ? totalSpent / orders.length : 0;
    const lastOrder = orders[0];

    // Loyalty
    const loyalty = await this.loyaltyRepo.findOne({ where: { user_id: id } });

    // Tickets
    const tickets = await this.ticketRepo.find({
      where: { user_id: id },
      order: { created_at: 'DESC' },
      take: 20,
    });

    // Reviews
    const reviews = await this.reviewRepo.find({
      where: { user_id: id },
      order: { created_at: 'DESC' },
      take: 20,
    });

    // Segment
    let segment = 'NEW';
    if (orders.length >= 10 || totalSpent >= 2000) segment = 'VIP';
    else if (orders.length >= 3) segment = 'LOYAL';
    else if (orders.length === 0) segment = 'PROSPECT';
    const daysSinceLastOrder = lastOrder
      ? Math.floor((Date.now() - new Date(lastOrder.created_at).getTime()) / 86400000)
      : null;
    if (daysSinceLastOrder != null && daysSinceLastOrder > 90 && orders.length > 0) segment = 'AT_RISK';

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        isActive: user.is_active,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        lastLogin: user.last_login,
      },
      summary: {
        orderCount: orders.length,
        totalSpent: Math.round(totalSpent * 100) / 100,
        averageOrderValue: Math.round(avgOrderValue * 100) / 100,
        lastOrderDate: lastOrder?.created_at || null,
        daysSinceLastOrder,
        segment,
      },
      loyalty: loyalty
        ? {
            tier: loyalty.tier,
            availablePoints: loyalty.available_points,
            lifetimePoints: loyalty.lifetime_points,
          }
        : null,
      orders: orders.map((o) => ({
        id: o.id,
        reference: o.reference,
        status: o.status,
        paymentStatus: o.payment_status,
        totalAmount: Number(o.total_amount),
        itemCount: 0,
        createdAt: o.created_at,
      })),
      tickets: tickets.map((t) => ({
        id: t.id,
        subject: t.subject,
        status: t.status,
        priority: t.priority,
        createdAt: t.created_at,
      })),
      reviews: reviews.map((r) => ({
        id: r.id,
        productId: r.product_id,
        rating: r.rating,
        title: r.title,
        isApproved: r.is_approved,
        createdAt: r.created_at,
      })),
    };
  }
}
