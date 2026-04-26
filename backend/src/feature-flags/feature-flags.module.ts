import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeatureFlagEvent } from './entities/flag-event.entity';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagsAdminController, FeatureFlagsPublicController } from './feature-flags.controller';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag, FeatureFlagEvent])],
  controllers: [FeatureFlagsAdminController, FeatureFlagsPublicController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
