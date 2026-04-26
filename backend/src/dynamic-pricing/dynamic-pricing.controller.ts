import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { DynamicPricingService } from './dynamic-pricing.service';

@Controller('admin/dynamic-pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class DynamicPricingAdminController {
  constructor(private readonly svc: DynamicPricingService) {}

  @Get('rules')
  async list() { return { items: await this.svc.listRules() }; }

  @Post('rules')
  create(@Body() body: any) { return this.svc.createRule(body); }

  @Put('rules/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any) { return this.svc.updateRule(id, body); }

  @Delete('rules/:id')
  remove(@Param('id', ParseIntPipe) id: number) { return this.svc.deleteRule(id); }

  // POST so it's not accidentally triggered by a browser prefetch.
  @Post('sweep')
  sweep(@Body() body: { dryRun?: boolean; productId?: number } = {}) {
    return this.svc.sweep(body);
  }

  @Get('changes')
  async changes(
    @Query('status') status?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ): Promise<any> {
    return { items: await this.svc.listChanges(status, limit) };
  }

  @Post('changes/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number): any { return this.svc.approveChange(id); }

  @Post('changes/:id/reject')
  reject(@Param('id', ParseIntPipe) id: number): any { return this.svc.rejectChange(id); }
}
