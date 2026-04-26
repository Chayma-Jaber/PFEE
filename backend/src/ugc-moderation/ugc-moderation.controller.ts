import { Body, Controller, DefaultValuePipe, Get, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { UgcModerationService } from './ugc-moderation.service';

@Controller('admin/ugc-moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class UgcModerationAdminController {
  constructor(private readonly svc: UgcModerationService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('queue')
  async queue(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit = 50): Promise<any> {
    return { items: await this.svc.reviewQueue(limit) };
  }

  @Post('run-pipeline')
  run(@Body() body: { limit?: number } = {}): any {
    return this.svc.runPipeline(body?.limit || 200);
  }
}
