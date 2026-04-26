import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorefrontExtrasController } from './storefront-extras.controller';
import { StorefrontWave3Controller } from './storefront-wave3.controller';

import { CartItem } from '../cart/entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { WishlistItem } from '../wishlist/entities/wishlist-item.entity';
import { LoyaltyAccount } from '../loyalty/entities/loyalty-account.entity';
import { StyleProfile } from '../users/entities/style-profile.entity';
import { FunnelEvent } from '../analytics/entities/funnel-event.entity';
import { Coupon } from '../promotions/entities/coupon.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { RecentlyViewed } from '../analytics/entities/recently-viewed.entity';
import { HomepageBlock } from '../admin/entities/homepage-block.entity';
import { AbTest, AbTestEvent } from '../admin/entities/ab-test.entity';
import { ProductPosition } from '../admin/entities/product-position.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { StockAlert } from '../alerts/entities/stock-alert.entity';
import { Bundle } from '../bundles/entities/bundle.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CartItem,
      Product,
      User,
      WishlistItem,
      LoyaltyAccount,
      StyleProfile,
      FunnelEvent,
      Coupon,
      Notification,
      RecentlyViewed,
      HomepageBlock,
      AbTest,
      AbTestEvent,
      ProductPosition,
      Order,
      OrderItem,
      StockAlert,
      Bundle,
    ]),
  ],
  controllers: [StorefrontExtrasController, StorefrontWave3Controller],
})
export class StorefrontModule {}
