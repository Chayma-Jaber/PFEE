import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supplier } from './entities/supplier.entity';
import { ProductSupplier } from './entities/product-supplier.entity';
import { PurchaseOrder } from './entities/purchase-order.entity';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';
import { ReplenishmentService } from './replenishment.service';
import { ReplenishmentAdminController } from './replenishment.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Supplier, ProductSupplier, PurchaseOrder, Product, Order])],
  controllers: [ReplenishmentAdminController],
  providers: [ReplenishmentService],
  exports: [ReplenishmentService],
})
export class ReplenishmentModule {}
