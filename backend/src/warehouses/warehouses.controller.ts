import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { WarehousesService } from './warehouses.service';

@Controller('admin/warehouses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class WarehousesAdminController {
  constructor(private readonly svc: WarehousesService) {}

  @Get()
  async list() {
    return { items: await this.svc.listWarehouses() };
  }

  @Post()
  async create(@Body() body: any) {
    return this.svc.createWarehouse(body);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    return this.svc.updateWarehouse(id, body);
  }

  @Post(':id/set-default')
  async setDefault(@Param('id', ParseIntPipe) id: number) {
    return this.svc.setDefault(id);
  }

  @Get('stats')
  async stats() {
    return this.svc.globalStats();
  }

  @Get('low-stock')
  async lowStock(@Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number) {
    return { items: await this.svc.lowStock(limit) };
  }

  @Get('products/:productId')
  async productStock(@Param('productId', ParseIntPipe) productId: number) {
    return this.svc.getStockForProduct(productId);
  }

  @Post('products/:productId/set')
  async setStock(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: { warehouseId: number; quantity: number; safetyStock?: number },
  ) {
    return this.svc.setStock(productId, body.warehouseId, Number(body.quantity), body.safetyStock);
  }

  @Post('products/:productId/adjust')
  async adjust(
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: { warehouseId: number; delta: number; safetyStock?: number },
  ) {
    return this.svc.adjust(productId, body.warehouseId, Number(body.delta), body.safetyStock);
  }
}
