import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { ReturnRequest, ReturnStatus } from '../orders/entities/return-request.entity';

@Controller('admin/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminReportsController {
  constructor(
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderItem) private readonly orderItemRepo: Repository<OrderItem>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ReturnRequest) private readonly returnRepo: Repository<ReturnRequest>,
  ) {}

  private getStartDate(period: string): Date {
    const now = new Date();
    const d = new Date(now);
    switch (period) {
      case '7d': d.setDate(d.getDate() - 7); break;
      case '90d': d.setDate(d.getDate() - 90); break;
      case '365d': d.setFullYear(d.getFullYear() - 1); break;
      case '30d':
      default: d.setDate(d.getDate() - 30); break;
    }
    return d;
  }

  @Get('sales')
  async salesReport(@Query('period') period = '30d') {
    const startDate = this.getStartDate(period);
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :s', { s: startDate })
      .getMany();

    const completed = orders.filter(
      (o) => o.status !== OrderStatus.CANCELLED && o.status !== OrderStatus.FAILED,
    );
    const totalRevenue = completed.reduce((sum, o) => sum + Number(o.total_amount || 0), 0);
    const totalOrders = orders.length;
    const completedOrders = completed.length;
    const aov = completedOrders > 0 ? totalRevenue / completedOrders : 0;

    // Group by day
    const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
    for (const o of orders) {
      const day = new Date(o.created_at).toISOString().slice(0, 10);
      const e = byDay.get(day) || { date: day, orders: 0, revenue: 0 };
      e.orders++;
      e.revenue += Number(o.total_amount || 0);
      byDay.set(day, e);
    }
    const dailySales = Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date));

    const paymentMethods: any[] = [];

    return {
      reportType: 'sales',
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalOrders,
        completedOrders,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        averageOrderValue: Math.round(aov * 100) / 100,
        conversionRate: 0,
      },
      dailySales,
      paymentMethods,
    };
  }

  @Get('customers')
  async customersReport(@Query('period') period = '30d') {
    const startDate = this.getStartDate(period);

    const totalCustomers = await this.userRepo.count({ where: { role: 'customer' as any } });
    const newCustomers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.role = :role', { role: 'customer' })
      .andWhere('u.created_at >= :s', { s: startDate })
      .getCount();

    const activeRows = await this.orderRepo
      .createQueryBuilder('o')
      .select('DISTINCT o.user_id', 'user_id')
      .where('o.created_at >= :s', { s: startDate })
      .getRawMany();
    const activeCustomers = activeRows.length;

    const growthRate = totalCustomers > 0 ? Math.round((newCustomers / totalCustomers) * 1000) / 10 : 0;

    const topRaw = await this.orderRepo
      .createQueryBuilder('o')
      .leftJoin('o.user', 'u')
      .select('u.id', 'id')
      .addSelect("u.first_name + ' ' + u.last_name", 'name')
      .addSelect('u.email', 'email')
      .addSelect('COUNT(o.id)', 'orderCount')
      .addSelect('SUM(o.total_amount)', 'totalSpent')
      .where('o.created_at >= :s', { s: startDate })
      .groupBy('u.id')
      .addGroupBy('u.first_name')
      .addGroupBy('u.last_name')
      .addGroupBy('u.email')
      .orderBy('SUM(o.total_amount)', 'DESC')
      .limit(10)
      .getRawMany();

    const topCustomers = topRaw.map((r) => ({
      id: r.id,
      name: r.name || 'N/A',
      email: r.email,
      orderCount: Number(r.orderCount) || 0,
      totalSpent: Math.round(Number(r.totalSpent || 0) * 100) / 100,
    }));

    return {
      reportType: 'customers',
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalCustomers,
        newCustomers,
        activeCustomers,
        growthRate,
      },
      topCustomers,
      dailySignups: [],
    };
  }

  @Get('products')
  async productsReport(@Query('period') period = '30d') {
    const startDate = this.getStartDate(period);

    const topRaw = await this.orderItemRepo
      .createQueryBuilder('oi')
      .leftJoin('oi.order', 'o')
      .select('oi.product_id', 'id')
      .addSelect('MIN(oi.title)', 'title')
      .addSelect('SUM(oi.quantity)', 'quantitySold')
      .addSelect('SUM(oi.quantity * oi.unit_price)', 'revenue')
      .where('o.created_at >= :s', { s: startDate })
      .groupBy('oi.product_id')
      .orderBy('SUM(oi.quantity)', 'DESC')
      .limit(10)
      .getRawMany();

    const topProducts = topRaw.map((r) => ({
      id: r.id,
      title: r.title || '-',
      quantitySold: Number(r.quantitySold) || 0,
      revenue: Math.round(Number(r.revenue || 0) * 100) / 100,
    }));

    const categoryBreakdown: any[] = [];

    return {
      reportType: 'products',
      period,
      generatedAt: new Date().toISOString(),
      topProducts,
      categoryBreakdown,
    };
  }

  @Get('returns')
  async returnsReport(@Query('period') period = '30d') {
    const startDate = this.getStartDate(period);

    const returns = await this.returnRepo
      .createQueryBuilder('r')
      .where('r.created_at >= :s', { s: startDate })
      .getMany();

    const totalReturns = returns.length;
    const pendingReturns = returns.filter((r) => r.status === ReturnStatus.PENDING).length;
    const approvedReturns = returns.filter((r) => r.status === ReturnStatus.APPROVED).length;
    const refunded = returns.filter((r) => r.status === ReturnStatus.REFUNDED);
    const totalRefunded = refunded.reduce((sum, r) => sum + Number(r.refund_amount || 0), 0);

    const totalOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.created_at >= :s', { s: startDate })
      .getCount();
    const returnRate = totalOrders > 0 ? Math.round((totalReturns / totalOrders) * 1000) / 10 : 0;

    const reasonMap = new Map<string, number>();
    for (const r of returns) {
      const key = r.reason || 'unknown';
      reasonMap.set(key, (reasonMap.get(key) || 0) + 1);
    }
    const reasonBreakdown = Array.from(reasonMap.entries()).map(([reason, count]) => ({ reason, count }));

    return {
      reportType: 'returns',
      period,
      generatedAt: new Date().toISOString(),
      summary: {
        totalReturns,
        pendingReturns,
        approvedReturns,
        totalRefunded: Math.round(totalRefunded * 100) / 100,
        returnRate,
      },
      reasonBreakdown,
    };
  }

  @Get('recent')
  async recent() {
    const now = new Date();
    const month = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    return [
      {
        name: `Ventes mensuelles - ${month}`,
        type: 'sales',
        typeLabel: 'Ventes',
        period: `${now.toLocaleDateString('fr-FR')}`,
        date: now.toLocaleDateString('fr-FR'),
        downloadUrl: `/api/admin/reports/export/sales?period=30d&format=csv`,
      },
    ];
  }

  @Get('export/:type')
  async exportReport(
    @Query('period') period = '30d',
    @Query('format') format = 'csv',
    @Res() res: Response,
  ) {
    // Reuse sales report
    const data = await this.salesReport(period);
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="report-${period}.json"`);
      res.send(JSON.stringify(data, null, 2));
      return;
    }
    // CSV
    const lines = ['date,orders,revenue'];
    for (const d of data.dailySales) {
      lines.push(`${d.date},${d.orders},${d.revenue}`);
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report-${period}.csv"`);
    res.send(lines.join('\n'));
  }
}
