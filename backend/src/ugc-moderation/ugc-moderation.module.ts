import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UgcPost } from '../wave4/wave4.entities';
import { UgcModerationService } from './ugc-moderation.service';
import { UgcModerationAdminController } from './ugc-moderation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UgcPost])],
  controllers: [UgcModerationAdminController],
  providers: [UgcModerationService],
  exports: [UgcModerationService],
})
export class UgcModerationModule {}
