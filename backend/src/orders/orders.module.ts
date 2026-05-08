import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { Product } from '../products/entities/product.entity';
import { StockMovement } from '../analytics/entities/stock-movement.entity';
import { StockAlert } from '../alerts/entities/stock-alert.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { Address } from '../users/entities/address.entity';
import { PromotionsModule } from '../promotions/promotions.module';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ReturnsController } from './returns.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      OrderStatusHistory,
      ReturnRequest,
      Product,
      StockMovement,
      StockAlert,
      Notification,
      Address,
    ]),
    PromotionsModule,
  ],
  controllers: [OrdersController, ReturnsController],
  providers: [OrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
