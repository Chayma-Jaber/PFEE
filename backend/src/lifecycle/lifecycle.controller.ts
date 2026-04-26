import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { LifecycleService } from './lifecycle.service';

@Controller('admin/lifecycle')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class LifecycleAdminController {
  constructor(private readonly svc: LifecycleService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('sequences')
  async sequences(): Promise<any> { return { items: await this.svc.listSequences() }; }

  @Post('sequences')
  create(@Body() body: any): any { return this.svc.createSequence(body); }

  @Put('sequences/:id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any): any { return this.svc.updateSequence(id, body); }

  @Delete('sequences/:id')
  remove(@Param('id', ParseIntPipe) id: number): any { return this.svc.deleteSequence(id); }

  @Get('enrollments')
  async enrollments(@Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100): Promise<any> {
    return { items: await this.svc.listEnrollments(limit) };
  }

  @Post('process-due')
  processDue(@Body() body: { limit?: number } = {}): any {
    return this.svc.processDue(body?.limit || 200);
  }

  // Render every step with sample data so the admin can verify templating.
  @Post('sequences/:id/preview')
  preview(@Param('id', ParseIntPipe) id: number, @Body() body: { sampleUserId?: number; sampleContext?: any } = {}): any {
    return this.svc.previewSequence(id, body?.sampleUserId, body?.sampleContext);
  }

  // Send one step immediately to a chosen user — admin-only, real send.
  @Post('sequences/:id/test-send')
  testSend(@Param('id', ParseIntPipe) id: number, @Body() body: { userId: number; stepIndex?: number; sampleContext?: any }): any {
    return this.svc.sendTestStep(id, body?.userId, body?.stepIndex || 0, body?.sampleContext);
  }
}
