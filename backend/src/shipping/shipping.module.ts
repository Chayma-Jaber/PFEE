import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Shipment } from './entities/shipment.entity';
import { Order } from '../orders/entities/order.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { User } from '../users/entities/user.entity';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';
import { FirstDeliveryProvider } from './providers/first-delivery.provider';
import { AramexProvider } from './providers/aramex.provider';
import { InternalProvider } from './providers/internal.provider';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Shipment, Order, Notification, User]),
    SmsModule,
  ],
  controllers: [ShippingController],
  providers: [ShippingService, FirstDeliveryProvider, AramexProvider, InternalProvider],
  exports: [ShippingService],
})
export class ShippingModule {}
