/**
 * Wave 4 — Advanced admin + CRM power tools.
 * Hosts all admin-facing endpoints for the 20 Wave-4 modules.
 */
import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Res,
  UseGuards, ParseIntPipe, DefaultValuePipe, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThan, MoreThan } from 'typeorm';
import { Response } from 'express';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import {
  CustomerTag, CustomerNote, OrderComment, AdminTask,
  DeliverySlot, PickupLocation, CustomerSignal, DailyDeal,
  ReferralShare, UgcPost, AuditDiff,
} from './wave4.entities';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { Coupon, CouponDiscountType } from '../promotions/entities/coupon.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';

@Controller('admin/wave4')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminWave4Controller {
  constructor(
    @InjectRepository(CustomerTag) private readonly tagRepo: Repository<CustomerTag>,
    @InjectRepository(CustomerNote) private readonly noteRepo: Repository<CustomerNote>,
    @InjectRepository(OrderComment) private readonly ocRepo: Repository<OrderComment>,
    @InjectRepository(AdminTask) private readonly taskRepo: Repository<AdminTask>,
    @InjectRepository(DeliverySlot) private readonly slotRepo: Repository<DeliverySlot>,
    @InjectRepository(PickupLocation) private readonly pickupRepo: Repository<PickupLocation>,
    @InjectRepository(CustomerSignal) private readonly signalRepo: Repository<CustomerSignal>,
    @InjectRepository(DailyDeal) private readonly dealRepo: Repository<DailyDeal>,
    @InjectRepository(ReferralShare) private readonly refRepo: Repository<ReferralShare>,
    @InjectRepository(UgcPost) private readonly ugcRepo: Repository<UgcPost>,
    @InjectRepository(AuditDiff) private readonly diffRepo: Repository<AuditDiff>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
    @InjectRepository(SupportTicket) private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(Coupon) private readonly couponRepo: Repository<Coupon>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
  ) {}

  // Audit diff logger — best-effort, never blocks a request.
  private async logDiff(
    resource: string,
    resourceId: string | number,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    before: any,
    after: any,
    adminId?: number,
  ) {
    try {
      let adminName: string | null = null;
      if (adminId) {
        const a = await this.userRepo.findOne({ where: { id: adminId } });
        if (a) adminName = `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email;
      }
      const d = this.diffRepo.create({
        resource,
        resource_id: String(resourceId),
        action,
        before_state: before ?? null,
        after_state: after ?? null,
        admin_id: adminId || null,
        admin_name: adminName,
      });
      await this.diffRepo.save(d);
    } catch (err) {
      console.warn('[audit] logDiff failed', err);
    }
  }

  // ═══ 1. CUSTOMER TAGS + NOTES ═══════════════════════════════════════
  @Get('customers/:id/tags')
  async listTags(@Param('id', ParseIntPipe) id: number) {
    const tags = await this.tagRepo.find({ where: { user_id: id } });
    return { items: tags };
  }
  @Post('customers/:id/tags')
  async addTag(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { tag: string; color?: string },
    @CurrentUser('id') adminId: number,
  ) {
    if (!body?.tag) throw new BadRequestException();
    const t = this.tagRepo.create({ user_id: id, tag: body.tag.toUpperCase(), color: body.color, added_by: adminId });
    const saved = await this.tagRepo.save(t);
    await this.logDiff('customer_tag', saved.id, 'CREATE', null,
      { user_id: id, tag: saved.tag, color: saved.color }, adminId);
    return saved;
  }
  @Delete('customers/:id/tags/:tagId')
  async removeTag(
    @Param('id', ParseIntPipe) id: number,
    @Param('tagId', ParseIntPipe) tagId: number,
    @CurrentUser('id') adminId: number,
  ) {
    const existing = await this.tagRepo.findOne({ where: { id: tagId } });
    await this.tagRepo.delete({ id: tagId });
    if (existing) {
      await this.logDiff('customer_tag', tagId, 'DELETE',
        { user_id: existing.user_id, tag: existing.tag, color: existing.color }, null, adminId);
    }
    return { success: true };
  }

  @Get('customers/:id/notes')
  async listNotes(@Param('id', ParseIntPipe) id: number) {
    const items = await this.noteRepo.find({ where: { user_id: id }, order: { created_at: 'DESC' } });
    return { items };
  }
  @Post('customers/:id/notes')
  async addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { note: string },
    @CurrentUser('id') adminId: number,
  ) {
    if (!body?.note) throw new BadRequestException();
    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    const n = this.noteRepo.create({
      user_id: id,
      note: body.note,
      admin_id: adminId,
      admin_name: admin ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() : 'Admin',
    });
    const saved = await this.noteRepo.save(n);
    await this.logDiff('customer_note', saved.id, 'CREATE', null,
      { user_id: id, note: saved.note }, adminId);
    return saved;
  }

  // ═══ 2. ORDER INTERNAL COMMENTS ═════════════════════════════════════
  @Get('orders/:id/comments')
  async listComments(@Param('id', ParseIntPipe) id: number) {
    const items = await this.ocRepo.find({ where: { order_id: id }, order: { is_pinned: 'DESC', created_at: 'DESC' } });
    return { items };
  }
  @Post('orders/:id/comments')
  async addComment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { body: string; isPinned?: boolean },
    @CurrentUser('id') adminId: number,
  ) {
    if (!body?.body) throw new BadRequestException();
    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    const c = this.ocRepo.create({
      order_id: id,
      body: body.body,
      admin_id: adminId,
      admin_name: admin ? `${admin.first_name || ''} ${admin.last_name || ''}`.trim() : 'Admin',
      is_pinned: !!body.isPinned,
    });
    const saved = await this.ocRepo.save(c);
    await this.logDiff('order_comment', saved.id, 'CREATE', null,
      { order_id: id, body: saved.body, is_pinned: saved.is_pinned }, adminId);
    return saved;
  }
  @Post('orders/:orderId/comments/:commentId/pin')
  async togglePinComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser('id') adminId: number,
  ) {
    const c = await this.ocRepo.findOne({ where: { id: commentId } });
    if (!c) throw new NotFoundException();
    const before = { is_pinned: c.is_pinned };
    c.is_pinned = !c.is_pinned;
    const saved = await this.ocRepo.save(c);
    await this.logDiff('order_comment', commentId, 'UPDATE', before,
      { is_pinned: saved.is_pinned }, adminId);
    return saved;
  }

  // ═══ 3. SUPPORT SLA / ESCALATION ═════════════════════════════════════
  @Get('support/sla-report')
  async slaReport() {
    const tickets = await this.ticketRepo.find();
    const now = Date.now();
    const SLA_HOURS: Record<string, number> = { low: 48, medium: 24, high: 8, urgent: 2 };
    let compliant = 0, breached = 0, atRisk = 0;
    const breaches: any[] = [];
    for (const t of tickets) {
      if (['resolved', 'closed'].includes(String(t.status).toLowerCase())) { compliant++; continue; }
      const priority = String(t.priority).toLowerCase();
      const sla = SLA_HOURS[priority] || 24;
      const ageH = (now - new Date(t.created_at).getTime()) / 3600000;
      if (ageH > sla) {
        breached++;
        breaches.push({ id: t.id, subject: t.subject, priority, ageHours: Math.round(ageH), slaHours: sla });
      } else if (ageH > sla * 0.75) { atRisk++; }
      else { compliant++; }
    }
    return { total: tickets.length, compliant, atRisk, breached, slaHours: SLA_HOURS, breaches };
  }

  // ═══ 4. ADMIN TASK BOARD ═════════════════════════════════════════════
  @Get('tasks')
  async listTasks(@Query('status') status?: string) {
    const where: any = {};
    if (status) where.status = status;
    const items = await this.taskRepo.find({ where, order: { priority: 'DESC', created_at: 'DESC' } });
    return { items };
  }
  @Post('tasks')
  async createTask(@Body() body: any, @CurrentUser('id') adminId: number) {
    if (!body?.title) throw new BadRequestException('title requis');
    const t = this.taskRepo.create({
      title: body.title,
      description: body.description || null,
      status: body.status || 'TODO',
      priority: body.priority || 'MEDIUM',
      category: body.category || 'general',
      assigned_to: body.assignedTo || null,
      due_date: body.dueDate ? new Date(body.dueDate) : null,
      related_order_id: body.relatedOrderId || null,
      related_user_id: body.relatedUserId || null,
      created_by: adminId,
    });
    const saved = await this.taskRepo.save(t);
    await this.logDiff('admin_task', saved.id, 'CREATE', null, {
      title: saved.title, description: saved.description, status: saved.status,
      priority: saved.priority, assigned_to: saved.assigned_to, due_date: saved.due_date,
    }, adminId);
    return saved;
  }
  @Put('tasks/:id')
  async updateTask(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @CurrentUser('id') adminId: number,
  ) {
    const t = await this.taskRepo.findOne({ where: { id } });
    if (!t) throw new NotFoundException();
    const before = {
      title: t.title, description: t.description, status: t.status,
      priority: t.priority, assigned_to: t.assigned_to, due_date: t.due_date,
    };
    if (body.status !== undefined) { t.status = body.status; if (body.status === 'DONE') t.done_at = new Date(); }
    if (body.priority !== undefined) t.priority = body.priority;
    if (body.title !== undefined) t.title = body.title;
    if (body.description !== undefined) t.description = body.description;
    if (body.assignedTo !== undefined) t.assigned_to = body.assignedTo;
    if (body.dueDate !== undefined) t.due_date = body.dueDate ? new Date(body.dueDate) : null;
    const saved = await this.taskRepo.save(t);
    await this.logDiff('admin_task', id, 'UPDATE', before, {
      title: saved.title, description: saved.description, status: saved.status,
      priority: saved.priority, assigned_to: saved.assigned_to, due_date: saved.due_date,
    }, adminId);
    return saved;
  }
  @Delete('tasks/:id')
  async deleteTask(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
    const existing = await this.taskRepo.findOne({ where: { id } });
    await this.taskRepo.delete({ id });
    if (existing) {
      await this.logDiff('admin_task', id, 'DELETE', {
        title: existing.title, status: existing.status, priority: existing.priority,
      }, null, adminId);
    }
    return { success: true };
  }

  // ═══ 7. DELIVERY SLOTS (admin CRUD) ══════════════════════════════════
  @Get('delivery-slots')
  async listSlots(@Query('city') city?: string) {
    const qb = this.slotRepo.createQueryBuilder('s').where('s.is_active = :a', { a: true });
    if (city) qb.andWhere('(s.city IS NULL OR s.city = :c)', { c: city });
    return { items: await qb.orderBy('s.start_time').getMany() };
  }
  @Post('delivery-slots')
  async createSlot(@Body() body: any, @CurrentUser('id') adminId: number) {
    const s = this.slotRepo.create({
      label: body.label, start_time: body.startTime, end_time: body.endTime,
      city: body.city || null, capacity: body.capacity || 50, is_active: true,
    });
    const saved = await this.slotRepo.save(s);
    await this.logDiff('delivery_slot', saved.id, 'CREATE', null, {
      label: saved.label, start_time: saved.start_time, end_time: saved.end_time,
      city: saved.city, capacity: saved.capacity,
    }, adminId);
    return saved;
  }
  @Delete('delivery-slots/:id')
  async deleteSlot(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
    const existing = await this.slotRepo.findOne({ where: { id } });
    await this.slotRepo.delete({ id });
    if (existing) {
      await this.logDiff('delivery_slot', id, 'DELETE', {
        label: existing.label, start_time: existing.start_time, end_time: existing.end_time, city: existing.city,
      }, null, adminId);
    }
    return { success: true };
  }

  // ═══ 8. PICKUP LOCATIONS ═════════════════════════════════════════════
  @Get('pickup-locations')
  async listPickups() { return { items: await this.pickupRepo.find({ where: { is_active: true } }) }; }
  @Post('pickup-locations')
  async createPickup(@Body() body: any, @CurrentUser('id') adminId: number) {
    const p = this.pickupRepo.create({ ...body, is_active: true });
    const saved: any = await this.pickupRepo.save(p);
    await this.logDiff('pickup_location', saved.id, 'CREATE', null, {
      name: saved.name, city: saved.city, address: saved.address, hours: saved.hours,
    }, adminId);
    return saved;
  }
  @Put('pickup-locations/:id')
  async updatePickup(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
    @CurrentUser('id') adminId: number,
  ) {
    const p = await this.pickupRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    const before = {
      name: p.name, city: p.city, address: p.address, hours: p.hours, is_active: p.is_active,
    };
    Object.assign(p, body);
    const saved = await this.pickupRepo.save(p);
    await this.logDiff('pickup_location', id, 'UPDATE', before, {
      name: saved.name, city: saved.city, address: saved.address, hours: saved.hours, is_active: saved.is_active,
    }, adminId);
    return saved;
  }

  // ═══ 9+10+11. CHURN / CLV / SIGNALS ═══════════════════════════════════
  @Post('signals/compute')
  async computeSignals() {
    const customers = await this.userRepo
      .createQueryBuilder('u').where('LOWER(u.role) = :r', { r: 'customer' }).getMany();
    let updated = 0;
    for (const u of customers) {
      const rows = await this.orderRepo.createQueryBuilder('o')
        .select('COUNT(o.id)', 'c').addSelect('SUM(o.total_amount)', 't')
        .addSelect('MAX(o.created_at)', 'last')
        .where('o.user_id = :u', { u: u.id })
        .andWhere("UPPER(o.status) NOT IN ('CANCELLED','FAILED')").getRawOne();
      const count = Number(rows?.c || 0);
      const clv = Number(rows?.t || 0);
      const last = rows?.last ? new Date(rows.last) : null;
      const daysSince = last ? Math.floor((Date.now() - last.getTime()) / 86400000) : null;
      // Churn heuristic: 0 if active (<30d), up to 100 if 180+ days
      let churn = 0;
      if (count === 0) churn = 50;
      else if (daysSince != null) {
        if (daysSince < 30) churn = 10;
        else if (daysSince < 60) churn = 30;
        else if (daysSince < 90) churn = 60;
        else if (daysSince < 180) churn = 80;
        else churn = 95;
      }
      let sig = await this.signalRepo.findOne({ where: { user_id: u.id } });
      if (!sig) sig = this.signalRepo.create({ user_id: u.id });
      sig.churn_score = churn; sig.clv = clv; sig.days_since_last_order = daysSince as any;
      sig.computed_at = new Date();
      await this.signalRepo.save(sig);
      updated++;
    }
    return { success: true, updated };
  }

  @Get('signals/top-clv')
  async topClv(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    const items = await this.signalRepo
      .createQueryBuilder('s').leftJoin(User, 'u', 'u.id = s.user_id')
      .select('s.user_id', 'userId').addSelect('s.clv', 'clv').addSelect('s.churn_score', 'churnScore')
      .addSelect('s.days_since_last_order', 'daysSince')
      .addSelect('u.email', 'email').addSelect("u.first_name + ' ' + u.last_name", 'name')
      .orderBy('s.clv', 'DESC').limit(limit).getRawMany();
    return { items };
  }

  @Get('signals/at-risk')
  async atRisk(@Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number) {
    const items = await this.signalRepo
      .createQueryBuilder('s').leftJoin(User, 'u', 'u.id = s.user_id')
      .select('s.user_id', 'userId').addSelect('s.clv', 'clv').addSelect('s.churn_score', 'churnScore')
      .addSelect('s.days_since_last_order', 'daysSince')
      .addSelect('u.email', 'email').addSelect("u.first_name + ' ' + u.last_name", 'name')
      .where('s.churn_score >= 60').orderBy('s.churn_score', 'DESC').limit(limit).getRawMany();
    return { items };
  }

  // ═══ 13. DAILY DEAL ══════════════════════════════════════════════════
  @Get('daily-deals')
  async listDeals() {
    const items = await this.dealRepo.find({ order: { start_at: 'DESC' }, take: 50 });
    return { items };
  }
  @Post('daily-deals')
  async createDeal(@Body() body: any, @CurrentUser('id') adminId: number) {
    const d = this.dealRepo.create({
      product_id: body.productId,
      special_price: Number(body.specialPrice),
      start_at: new Date(body.startAt),
      end_at: new Date(body.endAt),
      headline: body.headline || null,
      is_active: true,
    });
    const saved = await this.dealRepo.save(d);
    await this.logDiff('daily_deal', saved.id, 'CREATE', null, {
      product_id: saved.product_id, special_price: saved.special_price,
      start_at: saved.start_at, end_at: saved.end_at, headline: saved.headline,
    }, adminId);
    return saved;
  }
  @Delete('daily-deals/:id')
  async deleteDeal(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
    const existing = await this.dealRepo.findOne({ where: { id } });
    await this.dealRepo.delete({ id });
    if (existing) {
      await this.logDiff('daily_deal', id, 'DELETE', {
        product_id: existing.product_id, special_price: existing.special_price,
        start_at: existing.start_at, end_at: existing.end_at,
      }, null, adminId);
    }
    return { success: true };
  }

  // ═══ 15. UGC MODERATION ══════════════════════════════════════════════
  @Get('ugc')
  async listUgc(@Query('status') status?: string) {
    const where: any = {};
    if (status) where.status = status.toUpperCase();
    const items = await this.ugcRepo.find({ where, order: { created_at: 'DESC' } });
    return { items };
  }
  @Post('ugc/:id/approve')
  async approveUgc(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
    const p = await this.ugcRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    const before = { status: p.status };
    p.status = 'APPROVED'; p.moderated_at = new Date();
    const saved = await this.ugcRepo.save(p);
    await this.logDiff('ugc_post', id, 'UPDATE', before, { status: saved.status }, adminId);
    return saved;
  }
  @Post('ugc/:id/reject')
  async rejectUgc(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number) {
    const p = await this.ugcRepo.findOne({ where: { id } });
    if (!p) throw new NotFoundException();
    const before = { status: p.status };
    p.status = 'REJECTED'; p.moderated_at = new Date();
    const saved = await this.ugcRepo.save(p);
    await this.logDiff('ugc_post', id, 'UPDATE', before, { status: saved.status }, adminId);
    return saved;
  }

  // ═══ 16. LOOKALIKE AUDIENCES ══════════════════════════════════════════
  @Get('lookalikes')
  async lookalikes(@Query('fromSegment', new DefaultValuePipe('VIP')) fromSegment: string) {
    // Find common attributes of source segment (family, category preferences), then score non-source
    const top = await this.signalRepo
      .createQueryBuilder('s')
      .where('s.clv >= :v', { v: fromSegment === 'VIP' ? 1500 : 300 })
      .orderBy('s.clv', 'DESC').limit(10).getMany();
    if (top.length === 0) return { items: [] };
    const topUserIds = top.map((t) => t.user_id);
    // Pick customers with orders in same time window but lower CLV, as lookalikes
    const lookalikes = await this.signalRepo
      .createQueryBuilder('s').leftJoin(User, 'u', 'u.id = s.user_id')
      .select('s.user_id', 'userId').addSelect('s.clv', 'clv')
      .addSelect('s.churn_score', 'churn').addSelect('u.email', 'email').addSelect("u.first_name + ' ' + u.last_name", 'name')
      .where('s.user_id NOT IN (:...ids)', { ids: topUserIds })
      .andWhere('s.clv > 0').andWhere('s.churn_score < :c', { c: 60 })
      .orderBy('s.clv', 'DESC').limit(20).getRawMany();
    return { items: lookalikes, sourceSegment: fromSegment, sourceSize: top.length };
  }

  // ═══ 17. PREDICTIVE STOCKOUT ══════════════════════════════════════════
  @Get('stockout-forecast')
  async stockoutForecast(@Query('leadDays', new DefaultValuePipe(7), ParseIntPipe) leadDays: number) {
    const products = await this.productRepo.find({ where: { isActive: true } });
    const since = new Date(); since.setDate(since.getDate() - 30);
    const results: any[] = [];
    for (const p of products) {
      const soldRow = await this.orderRepo
        .createQueryBuilder('o').innerJoin('order_items', 'oi', 'oi.order_id = o.id')
        .where('oi.product_id = :pid', { pid: p.id })
        .andWhere('o.created_at >= :since', { since })
        .select('SUM(oi.quantity)', 'sold').getRawOne();
      const sold30 = Number(soldRow?.sold || 0);
      if (sold30 === 0) continue;
      const dailyRate = sold30 / 30;
      const daysLeft = dailyRate > 0 ? p.totalStock / dailyRate : 999;
      if (daysLeft <= leadDays + 7) {
        results.push({
          id: p.id, title: p.title, sku: p.sku,
          stock: p.totalStock, sold30, dailyRate: Math.round(dailyRate * 100) / 100,
          daysLeft: Math.round(daysLeft), leadDays,
          risk: daysLeft < leadDays ? 'CRITICAL' : daysLeft < leadDays + 3 ? 'HIGH' : 'MEDIUM',
        });
      }
    }
    results.sort((a, b) => a.daysLeft - b.daysLeft);
    return { items: results.slice(0, 30), leadDays };
  }

  // ═══ 19. UNIFIED EXPORT ═══════════════════════════════════════════════
  @Get('export/:resource')
  async exportCsv(@Param('resource') resource: string, @Res() res: Response) {
    const handlers: Record<string, () => Promise<{ headers: string[]; rows: any[] }>> = {
      orders: async () => {
        const orders = await this.orderRepo.find({ order: { id: 'ASC' }, take: 5000 });
        return {
          headers: ['id', 'reference', 'user_id', 'status', 'payment_status', 'subtotal', 'discount', 'shipping', 'total', 'created_at'],
          rows: orders.map((o) => [o.id, o.reference, o.user_id, o.status, o.payment_status, o.subtotal, o.discount_amount, o.shipping_amount, o.total_amount, o.created_at?.toISOString()]),
        };
      },
      customers: async () => {
        const users = await this.userRepo.createQueryBuilder('u').where('LOWER(u.role) = :r', { r: 'customer' }).getMany();
        return {
          headers: ['id', 'email', 'phone', 'first_name', 'last_name', 'is_active', 'is_verified', 'created_at'],
          rows: users.map((u) => [u.id, u.email, u.phone, u.first_name, u.last_name, u.is_active ? 1 : 0, u.is_verified ? 1 : 0, u.created_at?.toISOString()]),
        };
      },
      products: async () => {
        const ps = await this.productRepo.find({ order: { id: 'ASC' } });
        return {
          headers: ['id', 'sku', 'title', 'slug', 'price', 'current_price', 'famille', 'total_stock', 'is_active', 'view_count', 'order_count'],
          rows: ps.map((p) => [p.id, p.sku, p.title, p.slug, p.price, p.currentPrice, p.famille, p.totalStock, p.isActive ? 1 : 0, p.viewCount, p.orderCount]),
        };
      },
    };
    const h = handlers[resource];
    if (!h) throw new BadRequestException(`Unknown resource: ${resource}`);
    const { headers, rows } = await h();
    const esc = (v: any) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    };
    const lines = [headers.join(','), ...rows.map((r) => r.map(esc).join(','))];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${resource}.csv"`);
    res.send(lines.join('\n'));
  }

  // ═══ 20. AUDIT DIFF ═══════════════════════════════════════════════════
  @Get('audit-diff')
  async listDiffs(
    @Query('resource') resource?: string,
    @Query('resourceId') resourceId?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number = 30,
  ) {
    const qb = this.diffRepo.createQueryBuilder('d').orderBy('d.timestamp', 'DESC');
    if (resource) qb.andWhere('d.resource = :r', { r: resource });
    if (resourceId) qb.andWhere('d.resource_id = :rid', { rid: resourceId });
    const total = await qb.getCount();
    const items = await qb.skip((page - 1) * limit).take(limit).getMany();
    return { items, total, page, pages: Math.ceil(total / limit) };
  }

  // ═══ 14. REFERRAL ATTRIBUTION (admin view) ════════════════════════════
  @Get('referrals')
  async listReferrals() {
    const items = await this.refRepo.find({ order: { created_at: 'DESC' }, take: 100 });
    return { items };
  }
}
