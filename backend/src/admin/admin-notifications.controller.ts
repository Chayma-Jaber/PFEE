import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { Notification, NotificationType } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';

@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminNotificationsController {
  constructor(
    @InjectRepository(Notification) private readonly notifRepo: Repository<Notification>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  @Get('stats')
  async stats() {
    const total = await this.notifRepo.count();
    const unread = await this.notifRepo.count({ where: { is_read: false } });
    const totalCustomers = await this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.role) = :role', { role: 'customer' })
      .getCount();
    return { total, unread, totalCustomers };
  }

  @Get('recent')
  async recent(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const rows = await this.notifRepo
      .createQueryBuilder('n')
      .leftJoinAndSelect('n.user', 'u')
      .orderBy('n.created_at', 'DESC')
      .take(limit)
      .getMany();
    return {
      items: rows.map((n) => ({
        id: n.id,
        userId: n.user_id,
        userName: n.user ? `${n.user.first_name || ''} ${n.user.last_name || ''}`.trim() : '—',
        userEmail: n.user?.email,
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.is_read,
        actionUrl: n.action_url,
        createdAt: n.created_at,
      })),
    };
  }

  @Post('broadcast')
  async broadcast(
    @Body()
    body: {
      title: string;
      message: string;
      type?: string;
      actionUrl?: string;
      audience?: 'all' | 'customers' | 'specific';
      userIds?: number[];
    },
  ) {
    if (!body.title || !body.message) {
      throw new BadRequestException('Titre et message requis');
    }

    const type = (body.type || 'SYSTEM').toUpperCase() as NotificationType;
    const audience = body.audience || 'customers';

    let targetUsers: User[] = [];

    if (audience === 'specific' && Array.isArray(body.userIds) && body.userIds.length > 0) {
      targetUsers = await this.userRepo.find({ where: { id: In(body.userIds) } });
    } else if (audience === 'all') {
      targetUsers = await this.userRepo.find();
    } else {
      // customers (default)
      targetUsers = await this.userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.role) = :role', { role: 'customer' })
        .getMany();
    }

    if (targetUsers.length === 0) {
      return { success: false, sent: 0, message: 'Aucun destinataire trouvé' };
    }

    const notifications = targetUsers.map((u) =>
      this.notifRepo.create({
        user_id: u.id,
        type,
        title: body.title,
        message: body.message,
        action_url: body.actionUrl || null,
        is_read: false,
      }),
    );

    await this.notifRepo.save(notifications);

    return {
      success: true,
      sent: notifications.length,
      audience,
      type,
    };
  }
}
