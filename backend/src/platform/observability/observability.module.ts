import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ObservabilityService } from './observability.service';
import { ObservabilityInterceptor } from './observability.interceptor';
import { MetricsController, ObservabilityAdminController } from './observability.controller';

@Global()
@Module({
  controllers: [MetricsController, ObservabilityAdminController],
  providers: [
    ObservabilityService,
    { provide: APP_INTERCEPTOR, useClass: ObservabilityInterceptor },
  ],
  exports: [ObservabilityService],
})
export class ObservabilityModule {}
