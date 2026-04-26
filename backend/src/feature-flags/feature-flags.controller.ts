import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { FeatureFlagsService } from './feature-flags.service';

@Controller('feature-flags')
@SkipTransform()
export class FeatureFlagsPublicController {
  constructor(private readonly svc: FeatureFlagsService) {}

  // Customer-side: evaluate one or many flags. The frontend calls this on app boot
  // to get the flag-set for the current user/anonymous session.
  @Post('evaluate')
  @UseGuards(OptionalAuthGuard)
  async evaluate(
    @CurrentUser('id') userId: number | null,
    @Body() body: { keys: string[]; segments?: string[] },
  ): Promise<any> {
    const out: Record<string, any> = {};
    for (const k of (body?.keys || []).slice(0, 50)) {
      const decision = await this.svc.evaluate(k, userId, body?.segments || []);
      // Fire-and-forget exposure log
      this.svc.recordExposure(k, decision.variant, userId).catch(() => {});
      out[k] = decision;
    }
    return out;
  }

  @Post('convert')
  @UseGuards(OptionalAuthGuard)
  async convert(
    @CurrentUser('id') userId: number | null,
    @Body() body: { key: string; variant: string; goal: string; metadata?: any },
  ): Promise<any> {
    if (!body?.key || !body?.variant || !body?.goal) return { ok: false };
    await this.svc.recordConversion(body.key, body.variant, userId, body.goal, body.metadata);
    return { ok: true };
  }
}

@Controller('admin/feature-flags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class FeatureFlagsAdminController {
  constructor(private readonly svc: FeatureFlagsService) {}

  @Get() async list(): Promise<any> { return { items: await this.svc.list() }; }

  @Post() upsert(@Body() body: any): any { return this.svc.upsert(body); }

  @Put(':id/toggle')
  toggle(@Param('id', ParseIntPipe) id: number): any { return this.svc.toggle(id); }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): any { return this.svc.delete(id); }

  @Get(':key/results')
  async results(@Param('key') key: string, @Query('goal') goal?: string): Promise<any> {
    return { items: await this.svc.results(key, goal) };
  }
}
