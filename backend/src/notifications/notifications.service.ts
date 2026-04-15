import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from './entities/notification.entity';
import { NotificationQueryDto } from './dto/notification-query.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async createNotification(
    userId: number,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, any>,
    actionUrl?: string,
  ): Promise<Notification> {
    const notification = this.notificationRepo.create({
      user_id: userId,
      type,
      title,
      message,
      data: data || null,
      action_url: actionUrl || null,
    });

    return this.notificationRepo.save(notification);
  }

  async getUserNotifications(
    userId: number,
    query: NotificationQueryDto,
  ): Promise<{
    notifications: Notification[];
    total: number;
    unread_count: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const [notifications, total] = await this.notificationRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unread_count = await this.getUnreadCount(userId);

    return { notifications, total, unread_count, page, limit };
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notificationRepo.count({
      where: { user_id: userId, is_read: false },
    });
  }

  async markAsRead(notificationId: number, userId: number): Promise<Notification> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification #${notificationId} not found`);
    }

    if (notification.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this notification');
    }

    notification.is_read = true;
    return this.notificationRepo.save(notification);
  }

  async markAllAsRead(userId: number): Promise<{ updated: number }> {
    const result = await this.notificationRepo.update(
      { user_id: userId, is_read: false },
      { is_read: true },
    );

    return { updated: result.affected || 0 };
  }

  async deleteNotification(notificationId: number, userId: number): Promise<void> {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification #${notificationId} not found`);
    }

    if (notification.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this notification');
    }

    await this.notificationRepo.remove(notification);
  }
}
