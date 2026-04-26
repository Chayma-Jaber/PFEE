import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { FiscalService } from './fiscal.service';

@Controller('admin/fiscal')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class FiscalAdminController {
  constructor(private readonly svc: FiscalService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('receipts')
  async receipts(
    @Query('status') status?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ): Promise<any> {
    return { items: await this.svc.listReceipts({ status, limit }) };
  }

  @Post('orders/:orderId/generate')
  generate(@Param('orderId', ParseIntPipe) orderId: number): any { return this.svc.generate(orderId); }

  @Post('receipts/:id/submit')
  submit(@Param('id', ParseIntPipe) id: number): any { return this.svc.submitToTTN(id); }

  @Post('retry-pending')
  retry(@Body() body: { limit?: number } = {}): any { return this.svc.retryPending(body?.limit || 50); }

  @Get('vat-report')
  vat(
    @Query('year', new DefaultValuePipe(new Date().getFullYear()), ParseIntPipe) year: number,
    @Query('month', new DefaultValuePipe(new Date().getMonth() + 1), ParseIntPipe) month: number,
  ): any {
    return this.svc.vatReport(year, month);
  }
}
