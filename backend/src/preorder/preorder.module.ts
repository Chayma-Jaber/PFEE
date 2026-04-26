import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductDrop } from './entities/product-drop.entity';
import { PreorderReservation } from './entities/preorder-reservation.entity';
import { Product } from '../products/entities/product.entity';
import { PreorderService } from './preorder.service';
import { PreorderStorefrontController, PreorderAdminController } from './preorder.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductDrop, PreorderReservation, Product])],
  controllers: [PreorderStorefrontController, PreorderAdminController],
  providers: [PreorderService],
  exports: [PreorderService],
})
export class PreorderModule {}
