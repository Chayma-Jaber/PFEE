import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { ConfiguratorService } from './configurator.service';

@Controller('storefront/configurator')
@SkipTransform()
export class ConfiguratorStorefrontController {
  constructor(private readonly svc: ConfiguratorService) {}

  @Get()
  async list(): Promise<any> { return { items: await this.svc.listActive() }; }

  @Get(':slug')
  async get(@Param('slug') slug: string): Promise<any> { return this.svc.getFull(slug); }

  @Post(':id/price')
  price(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { selection: Array<{ slotId: number; productId: number; quantity?: number }> },
  ): any {
    return this.svc.price(id, body?.selection || []);
  }
}

@Controller('admin/configurator')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class ConfiguratorAdminController {
  constructor(private readonly svc: ConfiguratorService) {}

  @Get()
  async all(): Promise<any> { return { items: await this.svc.listAll() }; }

  @Post()
  create(@Body() body: any): any { return this.svc.createConfigurator(body); }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: any): any { return this.svc.updateConfigurator(id, body); }

  @Get(':id/slots')
  async slots(@Param('id', ParseIntPipe) id: number): Promise<any> {
    return { items: await this.svc.listSlotsFor(id) };
  }

  @Post(':id/slots')
  addSlot(@Param('id', ParseIntPipe) id: number, @Body() body: any): any {
    return this.svc.addSlot({ ...body, configurator_id: id });
  }

  @Delete('slots/:slotId')
  removeSlot(@Param('slotId', ParseIntPipe) slotId: number): any { return this.svc.removeSlot(slotId); }
}
