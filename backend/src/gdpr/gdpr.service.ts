import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';

import { GdprRequest, GdprRequestStatus, GdprRequestType } from './entities/gdpr-request.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { EventBusService } from '../platform/events/event-bus.service';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(
    @InjectRepository(GdprRequest) private readonly reqRepo: Repository<GdprRequest>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    private readonly eventBus: EventBusService,
  ) {}

  // Self-service: customer files a new request. Email verification token returned.
  async fileRequest(userId: number, type: GdprRequestType, reason?: string) {
    if (!Object.values(GdprRequestType).includes(type)) throw new BadRequestException('invalid type');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    const r = this.reqRepo.create({
      user_id: userId,
      type,
      status: GdprRequestStatus.RECEIVED,
      verification_token: randomUUID().replace(/-/g, '').slice(0, 32),
      reason_text: reason?.slice(0, 500) || null,
    });
    const saved = await this.reqRepo.save(r);
    this.eventBus.publish('gdpr.requested', { requestId: saved.id, userId, type }, {
      aggregateId: `gdpr:${saved.id}`, actorId: userId,
    }).catch(() => {});
    return saved;
  }

  // Verification: customer clicks the email link with the token. Marks request verified.
  async verify(token: string) {
    const r = await this.reqRepo.findOne({ where: { verification_token: token } });
    if (!r) throw new NotFoundException();
    if (r.verified_at) return r;
    r.verified_at = new Date();
    r.status = GdprRequestStatus.IN_PROGRESS;
    await this.reqRepo.save(r);
    return r;
  }

  async listMine(userId: number) {
    return this.reqRepo.find({ where: { user_id: userId }, order: { created_at: 'DESC' } });
  }

  // Export: returns a JSON snapshot of the user's data. Real deployment should
  // upload this to a private bucket and email the link; here we attach it inline.
  async runExport(requestId: number) {
    const r = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!r) throw new NotFoundException();
    if (r.type !== GdprRequestType.EXPORT) throw new BadRequestException('not an export request');
    if (!r.verified_at) throw new ForbiddenException('not verified');
    if (r.status === GdprRequestStatus.COMPLETED) return r;

    const user = await this.userRepo.findOne({ where: { id: r.user_id } });
    if (!user) throw new NotFoundException();
    const orders = await this.orderRepo.find({ where: { user_id: r.user_id }, order: { created_at: 'DESC' }, take: 1000 });
    const notifications = await this.notifRepo.find({ where: { user_id: r.user_id }, take: 500 });

    const payload = {
      generatedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        createdAt: user.created_at,
      },
      orders: orders.map((o) => ({
        id: o.id, reference: (o as any).reference, status: o.status,
        subtotal: (o as any).subtotal, total: (o as any).total_amount,
        createdAt: o.created_at,
      })),
      notifications: notifications.map((n) => ({
        id: n.id, type: n.type, title: n.title, message: n.message, isRead: (n as any).is_read,
        createdAt: n.created_at,
      })),
      counts: {
        orders: orders.length,
        notifications: notifications.length,
      },
    };

    r.export_payload = payload;
    r.status = GdprRequestStatus.COMPLETED;
    r.completed_at = new Date();
    await this.reqRepo.save(r);
    this.eventBus.publish('gdpr.export_completed', { requestId, userId: r.user_id }, {
      aggregateId: `gdpr:${requestId}`,
    }).catch(() => {});
    return r;
  }

  // Erasure: anonymize the user record + any PII in linked tables. Keeps fiscally-required
  // order data (anonymized) for 10 years per Tunisian law, like real GDPR balanced obligation.
  async runErasure(requestId: number, adminId: number) {
    const r = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!r) throw new NotFoundException();
    if (r.type !== GdprRequestType.ERASURE) throw new BadRequestException('not an erasure request');
    if (!r.verified_at) throw new ForbiddenException('not verified');
    if (r.status === GdprRequestStatus.COMPLETED) return r;

    const user = await this.userRepo.findOne({ where: { id: r.user_id } });
    if (!user) throw new NotFoundException();

    // Anonymize: keep id (referential), wipe PII
    const anonEmail = `deleted-${user.id}@anonymized.local`;
    user.email = anonEmail;
    user.first_name = 'Deleted';
    user.last_name = 'User';
    user.phone = null as any;
    (user as any).is_active = false;
    (user as any).is_verified = false;
    if ((user as any).password_hash !== undefined) (user as any).password_hash = '';
    await this.userRepo.save(user);

    // Delete notifications (they're not legally required)
    const notifDelete = await this.notifRepo.delete({ user_id: r.user_id });

    r.erasure_summary = {
      anonymizedEmail: anonEmail,
      ordersRetained: await this.orderRepo.count({ where: { user_id: r.user_id } }),
      notificationsDeleted: notifDelete.affected || 0,
      retentionNote: 'Order records retained for 10 years per fiscal obligation, with PII removed.',
    };
    r.status = GdprRequestStatus.COMPLETED;
    r.completed_at = new Date();
    r.admin_note = `Processed by admin #${adminId}`;
    await this.reqRepo.save(r);

    this.eventBus.publish('gdpr.erasure_completed', { requestId, userId: r.user_id }, {
      aggregateId: `gdpr:${requestId}`, actorId: adminId,
    }).catch(() => {});
    return r;
  }

  async reject(requestId: number, adminId: number, reason: string) {
    const r = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!r) throw new NotFoundException();
    r.status = GdprRequestStatus.REJECTED;
    r.admin_note = reason.slice(0, 1000);
    r.completed_at = new Date();
    await this.reqRepo.save(r);
    return r;
  }

  // Admin
  adminList(opts: { type?: string; status?: string } = {}) {
    const qb = this.reqRepo.createQueryBuilder('r').orderBy('r.created_at', 'DESC').take(500);
    if (opts.type) qb.andWhere('r.type = :t', { t: opts.type.toUpperCase() });
    if (opts.status) qb.andWhere('r.status = :s', { s: opts.status.toUpperCase() });
    return qb.getMany();
  }

  async stats() {
    const [total, received, inProgress, completed] = await Promise.all([
      this.reqRepo.count(),
      this.reqRepo.count({ where: { status: GdprRequestStatus.RECEIVED } }),
      this.reqRepo.count({ where: { status: GdprRequestStatus.IN_PROGRESS } }),
      this.reqRepo.count({ where: { status: GdprRequestStatus.COMPLETED } }),
    ]);
    return { total, received, inProgress, completed };
  }
}
