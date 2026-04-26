import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { ErpService } from './erp.service';
import { ErpAdminController } from './erp.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Product])],
  controllers: [ErpAdminController],
  providers: [ErpService],
  exports: [ErpService],
})
export class ErpModule {}
