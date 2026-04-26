import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SizeProfile } from './entities/size-profile.entity';
import { SizeChart } from './entities/size-chart.entity';
import { Product } from '../products/entities/product.entity';
import { SizingService } from './sizing.service';
import { SizingStorefrontController, SizingAdminController } from './sizing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SizeProfile, SizeChart, Product])],
  controllers: [SizingStorefrontController, SizingAdminController],
  providers: [SizingService],
  exports: [SizingService],
})
export class SizingModule {}
