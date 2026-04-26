import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Seller } from './entities/seller.entity';
import { SellerPayout } from './entities/seller-payout.entity';
import { SellerFulfillment } from './entities/seller-fulfillment.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';
import { MarketplaceService } from './marketplace.service';
import { SellerStorefrontController, MarketplaceAdminController } from './marketplace.controller';
import { SellerCatalogService } from './seller-catalog.service';
import { SellerCatalogController } from './seller-catalog.controller';
import { SmsModule } from '../sms/sms.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Seller, SellerPayout, SellerFulfillment, Order, OrderItem, Product, ProductImage, ProductVariant, User]),
    SmsModule,
    EmailModule,
  ],
  controllers: [SellerStorefrontController, MarketplaceAdminController, SellerCatalogController],
  providers: [MarketplaceService, SellerCatalogService],
  exports: [MarketplaceService, SellerCatalogService],
})
export class MarketplaceModule {}
