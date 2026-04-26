import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEvent } from './entities/user-event.entity';
import { AdminLog } from './entities/admin-log.entity';
import { RecentlyViewed } from './entities/recently-viewed.entity';
import { Product } from '../products/entities/product.entity';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { RecentlyViewedController } from './recently-viewed.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEvent, AdminLog, RecentlyViewed, Product])],
  controllers: [AnalyticsController, RecentlyViewedController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
