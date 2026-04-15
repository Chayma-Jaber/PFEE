import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bundle } from './entities/bundle.entity';
import { BundleItem } from './entities/bundle-item.entity';
import { BundlesService } from './bundles.service';
import { BundlesController } from './bundles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Bundle, BundleItem])],
  controllers: [BundlesController],
  providers: [BundlesService],
  exports: [BundlesService],
})
export class BundlesModule {}
