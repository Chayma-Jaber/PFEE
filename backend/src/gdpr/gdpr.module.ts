import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GdprRequest } from './entities/gdpr-request.entity';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { GdprService } from './gdpr.service';
import { GdprStorefrontController, GdprAdminController } from './gdpr.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GdprRequest, User, Order, Notification])],
  controllers: [GdprStorefrontController, GdprAdminController],
  providers: [GdprService],
  exports: [GdprService],
})
export class GdprModule {}
