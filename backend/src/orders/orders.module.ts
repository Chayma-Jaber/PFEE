import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { ReturnRequest } from './entities/return-request.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ReturnsController } from './returns.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderItem, OrderStatusHistory, ReturnRequest]),
  ],
  controllers: [OrdersController, ReturnsController],
  providers: [OrdersService],
  exports: [OrdersService, TypeOrmModule],
})
export class OrdersModule {}
