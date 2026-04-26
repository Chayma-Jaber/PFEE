import { Controller, Get, Query, Res, UseGuards, BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { ErpService } from './erp.service';

@Controller('admin/erp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class ErpAdminController {
  constructor(private readonly svc: ErpService) {}

  private parsePeriod(start?: string, end?: string): [Date, Date] {
    if (!start || !end) throw new BadRequestException('start + end ISO dates requis');
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new BadRequestException('invalid dates');
    return [s, e];
  }

  @Get('invoices')
  async invoices(@Query('start') start?: string, @Query('end') end?: string): Promise<any> {
    const [s, e] = this.parsePeriod(start, end);
    return { items: await this.svc.invoiceLines(s, e) };
  }

  @Get('invoices.csv')
  async invoicesCsv(@Query('start') start: string, @Query('end') end: string, @Res() res: Response): Promise<void> {
    const [s, e] = this.parsePeriod(start, end);
    const csv = await this.svc.exportCSV(s, e);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${start}_${end}.csv"`);
    res.send(csv);
  }

  @Get('invoices.xml')
  async invoicesXml(@Query('start') start: string, @Query('end') end: string, @Res() res: Response): Promise<void> {
    const [s, e] = this.parsePeriod(start, end);
    const xml = await this.svc.exportXML(s, e);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invoices_${start}_${end}.xml"`);
    res.send(xml);
  }

  @Get('gl-summary')
  glSummary(@Query('start') start?: string, @Query('end') end?: string): any {
    const [s, e] = this.parsePeriod(start, end);
    return this.svc.glSummary(s, e);
  }
}
