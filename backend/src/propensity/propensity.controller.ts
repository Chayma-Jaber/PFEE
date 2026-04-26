import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { PropensityService } from './propensity.service';

@Controller('admin/propensity')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class PropensityAdminController {
  constructor(private readonly svc: PropensityService) {}

  @Get('user/:userId')
  scoreUser(@Param('userId', ParseIntPipe) userId: number): any { return this.svc.scoreUser(userId); }

  @Post('score-all')
  scoreAll(@Body() body: { limit?: number } = {}): any { return this.svc.scoreAll(body?.limit || 1000); }

  @Get('top')
  top(
    @Query('metric', new DefaultValuePipe('clv')) metric: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit = 20,
  ): any {
    return this.svc.topByMetric(metric, limit).then((items) => ({ items, metric }));
  }
}
