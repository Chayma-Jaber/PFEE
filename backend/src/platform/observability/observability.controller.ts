import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { ObservabilityService } from './observability.service';

// Prometheus scrape endpoint — unauthenticated in dev. In prod put it behind nginx + IP allowlist
// (see the deploy sample conf) rather than auth, because Prom scrapers can't pass JWTs.
@Controller('metrics')
@SkipTransform()
export class MetricsController {
  constructor(private readonly obs: ObservabilityService) {}

  @Get()
  metrics(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(this.obs.prometheusText());
  }
}

// Admin-facing JSON snapshot + error list
@Controller('admin/observability')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class ObservabilityAdminController {
  constructor(private readonly obs: ObservabilityService) {}

  @Get('snapshot')
  snapshot(): any { return this.obs.snapshot(); }

  @Get('errors')
  errors(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100): any {
    return { items: this.obs.recentErrorsList(limit) };
  }
}
