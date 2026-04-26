import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Warehouse } from './entities/warehouse.entity';
import { ProductStock } from './entities/product-stock.entity';
import { Product } from '../products/entities/product.entity';
import { WarehousesService } from './warehouses.service';
import { WarehousesAdminController } from './warehouses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Warehouse, ProductStock, Product])],
  controllers: [WarehousesAdminController],
  providers: [WarehousesService],
  exports: [WarehousesService, TypeOrmModule],
})
export class WarehousesModule {}
