import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CmsPage } from './entities/cms-page.entity';
import { CmsRevision } from './entities/cms-revision.entity';
import { Product } from '../products/entities/product.entity';
import { CmsService } from './cms.service';
import { CmsPublicController, CmsAdminController } from './cms.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CmsPage, CmsRevision, Product])],
  controllers: [CmsPublicController, CmsAdminController],
  providers: [CmsService],
  exports: [CmsService],
})
export class CmsModule {}
