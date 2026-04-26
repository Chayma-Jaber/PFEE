import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';

import { LifecycleSequence } from './entities/lifecycle-sequence.entity';
import { LifecycleEnrollment } from './entities/lifecycle-enrollment.entity';
import { User } from '../users/entities/user.entity';
import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { EmailService } from '../email/email.service';
import { SmsService } from '../sms/sms.service';
import { EventBusService } from '../platform/events/event-bus.service';

@Injectable()
export class LifecycleService implements OnModuleInit {
  private readonly logger = new Logger(LifecycleService.name);

  constructor(
    @InjectRepository(LifecycleSequence) private readonly seqRepo: Repository<LifecycleSequence>,
    @InjectRepository(LifecycleEnrollment) private readonly enrollRepo: Repository<LifecycleEnrollment>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    private readonly email: EmailService,
    private readonly sms: SmsService,
    private readonly eventBus: EventBusService,
  ) {}

  // Subscribe to domain events on boot so we can auto-enroll users
  async onModuleInit() {
    this.eventBus.subscribe('user.registered', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'user.registered', p);
    });
    this.eventBus.subscribe('order.placed', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'order.placed', p);
    });
    this.eventBus.subscribe('cart.abandoned', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'cart.abandoned', p);
    });
    this.eventBus.subscribe('customer.churning', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'customer.churning', p);
    });
    this.eventBus.subscribe('order.delivered', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'order.delivered', p);
    });
    this.eventBus.subscribe('subscription.cancelled', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'subscription.cancelled', p);
    });
    this.eventBus.subscribe('fraud.held', async (p: any) => {
      // Suppress sequences when fraud flags the order
      if (p?.userId) await this.cancelActiveForUser(p.userId);
    });
    // Marketplace fulfillment triggers — sellers ship their own items, the buyer is the recipient
    this.eventBus.subscribe('seller.fulfillment.shipped', async (p: any) => {
      if (p?.buyerId) await this.enrollUserByTrigger(p.buyerId, 'seller.fulfillment.shipped', p);
    });
    this.eventBus.subscribe('seller.fulfillment.delivered', async (p: any) => {
      if (p?.buyerId) await this.enrollUserByTrigger(p.buyerId, 'seller.fulfillment.delivered', p);
    });
    this.eventBus.subscribe('seller.fulfillment.cancelled', async (p: any) => {
      if (p?.buyerId) await this.enrollUserByTrigger(p.buyerId, 'seller.fulfillment.cancelled', p);
    });
    // Mixed-order partial states — give admins drip hooks for "the seller part of your
    // order shipped, we're still preparing the rest" follow-ups.
    this.eventBus.subscribe('order.partially_shipped', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'order.partially_shipped', p);
    });
    this.eventBus.subscribe('order.partially_delivered', async (p: any) => {
      if (p?.userId) await this.enrollUserByTrigger(p.userId, 'order.partially_delivered', p);
    });
    this.logger.log('Lifecycle: event subscriptions wired');
  }

  // ═══ Sequence CRUD ═════════════════════════════════════════════════════

  listSequences() { return this.seqRepo.find({ order: { id: 'DESC' } }); }

  async createSequence(data: Partial<LifecycleSequence>) {
    if (!data.name || !data.trigger_event || !data.steps?.length) throw new Error('name + trigger + steps requis');
    return this.seqRepo.save(this.seqRepo.create({
      name: data.name,
      description: data.description || null,
      trigger_event: data.trigger_event,
      steps: data.steps,
      is_active: data.is_active !== false,
    }));
  }

  async updateSequence(id: number, patch: Partial<LifecycleSequence>) {
    const s = await this.seqRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException();
    Object.assign(s, patch);
    return this.seqRepo.save(s);
  }

  async deleteSequence(id: number) {
    await this.seqRepo.delete({ id });
    return { success: true };
  }

  // ═══ Enrollment ═══════════════════════════════════════════════════════

  async enrollUserByTrigger(userId: number, trigger: string, context?: any) {
    const seqs = await this.seqRepo.find({ where: { trigger_event: trigger, is_active: true } });
    for (const s of seqs) {
      // Skip if already enrolled in this sequence and still active
      const existing = await this.enrollRepo.findOne({ where: { sequence_id: s.id, user_id: userId, status: 'ACTIVE' } });
      if (existing) continue;
      const firstDelayHours = Number(s.steps?.[0]?.delayHours || 0);
      const next = new Date(Date.now() + firstDelayHours * 3600 * 1000);
      await this.enrollRepo.save(this.enrollRepo.create({
        sequence_id: s.id,
        user_id: userId,
        next_step_at: next,
        next_step_index: 0,
        context: context || null,
        status: 'ACTIVE',
      }));
    }
  }

  async cancelActiveForUser(userId: number) {
    await this.enrollRepo.createQueryBuilder().update(LifecycleEnrollment)
      .set({ status: 'CANCELLED' })
      .where('user_id = :u AND status = :s', { u: userId, s: 'ACTIVE' })
      .execute();
  }

  // ═══ Cron: send due steps ═════════════════════════════════════════════

  async processDue(limit = 200) {
    const now = new Date();
    const due = await this.enrollRepo.find({
      where: { status: 'ACTIVE', next_step_at: LessThanOrEqual(now) },
      take: limit,
    });

    let sent = 0, completed = 0, failed = 0;
    for (const e of due) {
      try {
        const seq = await this.seqRepo.findOne({ where: { id: e.sequence_id } });
        if (!seq) { e.status = 'CANCELLED'; await this.enrollRepo.save(e); continue; }
        if (!seq.is_active) { e.status = 'CANCELLED'; await this.enrollRepo.save(e); continue; }
        const step = seq.steps[e.next_step_index];
        if (!step) { e.status = 'COMPLETED'; await this.enrollRepo.save(e); completed++; continue; }

        const user = await this.userRepo.findOne({ where: { id: e.user_id } });
        if (!user) { e.status = 'FAILED'; await this.enrollRepo.save(e); failed++; continue; }

        const ctx = e.context || {};
        const subject = this.template(step.subject || '', user, ctx);
        const body = this.template(step.body || '', user, ctx);

        if (step.channel === 'EMAIL' && user.email) {
          await (this.email as any).sendMail?.(user.email, subject || '(Barsha)', body, body, { kind: 'OTHER', userId: user.id });
        } else if (step.channel === 'SMS' && user.phone) {
          await this.sms.sendSms({ to: user.phone, body: body.slice(0, 480), purpose: 'OTHER' as any, userId: user.id });
        } else if (step.channel === 'IN_APP') {
          await this.notifRepo.save(this.notifRepo.create({
            user_id: user.id,
            type: NotificationType.PROMOTION,
            title: subject || 'Nouveau message',
            message: body.slice(0, 1000),
            action_url: step.actionUrl || null,
            is_read: false,
          } as any));
        }

        sent++;
        e.next_step_index += 1;
        if (e.next_step_index >= seq.steps.length) {
          e.status = 'COMPLETED';
          completed++;
        } else {
          const next = seq.steps[e.next_step_index];
          e.next_step_at = new Date(Date.now() + (Number(next.delayHours) || 0) * 3600 * 1000);
        }
        await this.enrollRepo.save(e);
      } catch (err: any) {
        this.logger.warn(`enrollment ${e.id} failed: ${err?.message || err}`);
        e.status = 'FAILED';
        await this.enrollRepo.save(e).catch(() => {});
        failed++;
      }
    }
    return { considered: due.length, sent, completed, failed };
  }

  private template(s: string, user: any, ctx: any): string {
    return s
      .replace(/\{\{\s*firstName\s*\}\}/gi, user.first_name || 'Cher client')
      .replace(/\{\{\s*lastName\s*\}\}/gi, user.last_name || '')
      .replace(/\{\{\s*email\s*\}\}/gi, user.email || '')
      .replace(/\{\{\s*orderId\s*\}\}/gi, String(ctx.orderId || ''))
      .replace(/\{\{\s*orderRef\s*\}\}/gi, String(ctx.orderRef || ctx.reference || ''))
      .replace(/\{\{\s*cartUrl\s*\}\}/gi, ctx.cartUrl || '/panier')
      .replace(/\{\{\s*coupon\s*\}\}/gi, ctx.couponCode || '')
      // Marketplace fulfillment tokens — populated by `seller.fulfillment.*` event payloads
      .replace(/\{\{\s*trackingNumber\s*\}\}/gi, String(ctx.trackingNumber || ''))
      .replace(/\{\{\s*carrier\s*\}\}/gi, String(ctx.carrier || ''))
      .replace(/\{\{\s*trackingUrl\s*\}\}/gi, String(ctx.trackingUrl || ''))
      .replace(/\{\{\s*sellerName\s*\}\}/gi, String(ctx.sellerName || ''))
      .replace(/\{\{\s*itemTitle\s*\}\}/gi, String(ctx.itemTitle || ''))
      .replace(/\{\{\s*cancellationReason\s*\}\}/gi, String(ctx.reason || ''));
  }

  // ═══ Preview & test send ══════════════════════════════════════════════

  // Render every step of a sequence with sample/real user data — no side-effects.
  // Used by the admin "Preview" panel to verify templating before going live.
  async previewSequence(sequenceId: number, sampleUserId?: number, sampleContext?: any) {
    const seq = await this.seqRepo.findOne({ where: { id: sequenceId } });
    if (!seq) throw new NotFoundException('Sequence not found');

    let user: any;
    if (sampleUserId) {
      user = await this.userRepo.findOne({ where: { id: sampleUserId } });
    }
    if (!user) {
      user = { id: 0, first_name: 'Aymen', last_name: 'Ben Ali', email: 'sample@barsha.com.tn', phone: '+21612345678' };
    }
    const ctx = sampleContext || { orderRef: 'ORD-2026-DEMO-001', orderId: 999, couponCode: 'BARSHA10', cartUrl: '/panier' };

    return {
      sequence: { id: seq.id, name: seq.name, trigger_event: seq.trigger_event, is_active: seq.is_active },
      sampleUser: { id: user.id, name: `${user.first_name || ''} ${user.last_name || ''}`.trim(), email: user.email, phone: user.phone },
      sampleContext: ctx,
      renderedSteps: (seq.steps || []).map((step: any, idx: number) => ({
        index: idx,
        delayHours: step.delayHours,
        channel: step.channel,
        renderedSubject: this.template(step.subject || '', user, ctx),
        renderedBody: this.template(step.body || '', user, ctx),
        actionUrl: step.actionUrl || null,
        couponCode: step.couponCode || null,
      })),
    };
  }

  // Send a single step IMMEDIATELY to a chosen user — bypasses delays + enrollment.
  // For admin testing only; never billed against real cron throughput.
  async sendTestStep(sequenceId: number, userId: number, stepIndex = 0, sampleContext?: any) {
    const seq = await this.seqRepo.findOne({ where: { id: sequenceId } });
    if (!seq) throw new NotFoundException('Sequence not found');
    const step = (seq.steps || [])[stepIndex];
    if (!step) throw new NotFoundException('Step not found');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const ctx = sampleContext || { orderRef: 'ORD-TEST-' + Date.now(), couponCode: 'BARSHA-TEST', cartUrl: '/panier' };
    const subject = this.template(step.subject || '[TEST]', user, ctx);
    const body = this.template(step.body || '', user, ctx);
    const tagged = `[TEST – séquence "${seq.name}", étape ${stepIndex + 1}]\n\n` + body;

    let outcome: { sent: boolean; channel: string; reason?: string } = { sent: false, channel: step.channel };
    try {
      if (step.channel === 'EMAIL') {
        if (!user.email) { outcome.reason = 'user has no email'; }
        else {
          const ok = await (this.email as any).sendMail?.(user.email, '[TEST] ' + subject, tagged, tagged, { kind: 'OTHER', userId: user.id });
          outcome.sent = !!ok;
        }
      } else if (step.channel === 'SMS') {
        if (!user.phone) { outcome.reason = 'user has no phone'; }
        else {
          const row = await this.sms.sendSms({ to: user.phone, body: tagged.slice(0, 480), purpose: 'OTHER' as any, userId: user.id });
          outcome.sent = row.status !== 'FAILED';
          if (!outcome.sent) outcome.reason = row.error_message || undefined;
        }
      } else if (step.channel === 'IN_APP') {
        await this.notifRepo.save(this.notifRepo.create({
          user_id: user.id,
          type: NotificationType.PROMOTION,
          title: '[TEST] ' + subject,
          message: tagged.slice(0, 1000),
          action_url: step.actionUrl || null,
          is_read: false,
        } as any));
        outcome.sent = true;
      }
    } catch (err: any) {
      outcome.reason = err?.message || 'send failed';
    }

    return {
      sequenceId: seq.id, userId: user.id, stepIndex,
      preview: { subject, body },
      outcome,
    };
  }

  // ═══ Admin stats ═══════════════════════════════════════════════════════

  async stats() {
    const [sequences, active, completed, failed] = await Promise.all([
      this.seqRepo.count(),
      this.enrollRepo.count({ where: { status: 'ACTIVE' } }),
      this.enrollRepo.count({ where: { status: 'COMPLETED' } }),
      this.enrollRepo.count({ where: { status: 'FAILED' } }),
    ]);
    return { sequences, active, completed, failed };
  }

  listEnrollments(limit = 100) {
    return this.enrollRepo.createQueryBuilder('e').orderBy('e.created_at', 'DESC').take(Math.min(500, limit)).getMany();
  }
}
