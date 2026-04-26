import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { ReplenishmentService } from './replenishment.service';

@Controller('admin/replenishment')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class ReplenishmentAdminController {
  constructor(private readonly svc: ReplenishmentService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('suppliers') async suppliers(): Promise<any> { return { items: await this.svc.listSuppliers() }; }
  @Post('suppliers') createSupplier(@Body() body: any): any { return this.svc.createSupplier(body); }
  @Put('suppliers/:id') updateSupplier(@Param('id', ParseIntPipe) id: number, @Body() body: any): any {
    return this.svc.updateSupplier(id, body);
  }

  @Post('product-suppliers')
  setProductSupplier(@Body() body: { productId: number; supplierId: number; unitCost: number; isPrimary?: boolean }): any {
    return this.svc.setProductSupplier(body.productId, body.supplierId, body.unitCost, body.isPrimary !== false);
  }

  @Get('forecast')
  forecast(@Query('leadDays', new DefaultValuePipe(14), ParseIntPipe) leadDays = 14): any {
    return this.svc.forecast(leadDays).then((items) => ({ items, leadDays }));
  }

  @Post('generate-pos')
  generate(
    @CurrentUser('id') adminId: number,
    @Body() body: { leadDays?: number; warehouseId?: number; risk?: 'CRITICAL' | 'HIGH' | 'MEDIUM' } = {},
  ): any {
    return this.svc.generatePODrafts(adminId, body);
  }

  @Get('pos')
  async listPOs(@Query('status') status?: string): Promise<any> { return { items: await this.svc.listPOs(status) }; }

  @Post('pos/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number): any {
    return this.svc.approvePO(id, adminId);
  }

  @Post('pos/:id/send')
  send(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number): any {
    return this.svc.sendPO(id, adminId);
  }

  @Post('pos/:id/receive')
  receive(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number): any {
    return this.svc.receivePO(id, adminId);
  }

  @Post('pos/:id/cancel')
  cancel(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number, @Body() body: { reason?: string }): any {
    return this.svc.cancelPO(id, adminId, body?.reason);
  }
}
