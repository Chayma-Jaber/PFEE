import { Module } from '@nestjs/common';
import { ExpansionSchedulerService } from './expansion-scheduler.service';
import { SubscriptionsModule } from '../../subscriptions/subscriptions.module';
import { LifecycleModule } from '../../lifecycle/lifecycle.module';
import { DynamicPricingModule } from '../../dynamic-pricing/dynamic-pricing.module';
import { FiscalModule } from '../../fiscal/fiscal.module';
import { UgcModerationModule } from '../../ugc-moderation/ugc-moderation.module';
import { PropensityModule } from '../../propensity/propensity.module';

@Module({
  imports: [SubscriptionsModule, LifecycleModule, DynamicPricingModule, FiscalModule, UgcModerationModule, PropensityModule],
  providers: [ExpansionSchedulerService],
})
export class ExpansionSchedulerModule {}
