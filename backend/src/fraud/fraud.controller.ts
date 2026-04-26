import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { FraudService } from './fraud.service';
import { FraudStatus } from './entities/fraud-signal.entity';

@Controller('storefront/fraud')
@SkipTransform()
export class FraudStorefrontController {
  constructor(private readonly svc: FraudService) {}

  // Customer-side: capture device fingerprint. Called at page load + before checkout.
  @Post('fingerprint')
  async fingerprint(
    @Req() req: Request,
    @CurrentUser('id') userId: number | null,
    @Body() body: { fingerprint: string; timezone?: string; screenResolution?: string },
  ) {
    if (!body?.fingerprint) return { ok: false };
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const ua = (req.headers['user-agent'] as string) || null;
    await this.svc.recordFingerprint({
      fingerprint: body.fingerprint,
      userId: userId ?? null,
      ip,
      userAgent: ua,
      timezone: body.timezone,
      screenResolution: body.screenResolution,
    });
    return { ok: true };
  }
}

@Controller('admin/fraud')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class FraudAdminController {
  constructor(private readonly svc: FraudService) {}

  @Get('stats')
  stats() { return this.svc.stats(); }

  @Get('queue')
  async queue(
    @Query('status') status?: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50,
  ) {
    const st = status ? (status.toUpperCase() as FraudStatus) : undefined;
    return { items: await this.svc.listForReview({ status: st, limit }) };
  }

  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() body: { note?: string },
  ) {
    return this.svc.approve(id, adminId, body?.note);
  }

  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() body: { note?: string },
  ) {
    return this.svc.reject(id, adminId, body?.note);
  }
}
