import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SubscriptionsService } from '../../subscriptions/subscriptions.service';
import { LifecycleService } from '../../lifecycle/lifecycle.service';
import { DynamicPricingService } from '../../dynamic-pricing/dynamic-pricing.service';
import { FiscalService } from '../../fiscal/fiscal.service';
import { UgcModerationService } from '../../ugc-moderation/ugc-moderation.service';
import { PropensityService } from '../../propensity/propensity.service';
import { ObservabilityService } from '../observability/observability.service';

/**
 * Cron schedule for the post-Wave-4 expansion roadmap. Each job is best-effort: a
 * thrown error is logged + counted in observability but never crashes the runtime.
 *
 * | Job                       | When                | Why this cadence |
 * |---------------------------|---------------------|------------------|
 * | subscriptions:processDue  | every 15 min        | low-latency renewals & dunning |
 * | lifecycle:processDue      | every 5 min         | drip emails feel snappy |
 * | dynamic-pricing:sweep     | daily 02:00         | overnight inventory-age repricing |
 * | fiscal:retryPending       | every 30 min        | TTN gateways flake; retry often |
 * | ugc-moderation:run        | every 10 min        | review queue stays fresh |
 * | propensity:scoreAll       | daily 04:00         | piggybacks on wave4 churn job |
 */
@Injectable()
export class ExpansionSchedulerService {
  private readonly logger = new Logger(ExpansionSchedulerService.name);

  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly lifecycle: LifecycleService,
    private readonly dynamicPricing: DynamicPricingService,
    private readonly fiscal: FiscalService,
    private readonly ugcModeration: UgcModerationService,
    private readonly propensity: PropensityService,
    private readonly obs: ObservabilityService,
  ) {}

  private async runJob<T>(name: string, fn: () => Promise<T>): Promise<void> {
    const t0 = Date.now();
    try {
      const result = await fn();
      this.obs.incLabeled('cron_jobs_total', `${name}:ok`);
      this.obs.recordLatency(`cron:${name}`, Date.now() - t0);
      this.logger.log(`${name} ok in ${Date.now() - t0}ms — ${JSON.stringify(result).slice(0, 200)}`);
    } catch (err: any) {
      this.obs.incLabeled('cron_jobs_total', `${name}:error`);
      this.obs.recordError({ message: err?.message || String(err), stack: err?.stack }, { cron: name });
      this.logger.warn(`${name} failed: ${err?.message || err}`);
    }
  }

  @Cron('*/15 * * * *', { name: 'expansion:subscriptions-due' })
  subscriptionsDue() {
    return this.runJob('subscriptions:processDue', () => this.subscriptions.processDue(100));
  }

  @Cron('*/5 * * * *', { name: 'expansion:lifecycle-due' })
  lifecycleDue() {
    return this.runJob('lifecycle:processDue', () => this.lifecycle.processDue(200));
  }

  @Cron('0 2 * * *', { name: 'expansion:dynamic-pricing-sweep' })
  dynamicPricingSweep() {
    return this.runJob('dynamic-pricing:sweep', () => this.dynamicPricing.sweep({ dryRun: false }));
  }

  @Cron('*/30 * * * *', { name: 'expansion:fiscal-retry' })
  fiscalRetry() {
    return this.runJob('fiscal:retryPending', () => this.fiscal.retryPending(50));
  }

  @Cron('*/10 * * * *', { name: 'expansion:ugc-moderation' })
  ugcPipeline() {
    return this.runJob('ugc-moderation:run', () => this.ugcModeration.runPipeline(200));
  }

  @Cron('0 4 * * *', { name: 'expansion:propensity-score-all' })
  propensityDaily() {
    return this.runJob('propensity:scoreAll', () => this.propensity.scoreAll(2000));
  }
}
