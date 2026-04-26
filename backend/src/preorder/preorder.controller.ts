import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { PreorderService } from './preorder.service';

@Controller('storefront/preorder')
@SkipTransform()
export class PreorderStorefrontController {
  constructor(private readonly svc: PreorderService) {}

  @Get('drop/product/:productId')
  async byProduct(@Param('productId', ParseIntPipe) productId: number): Promise<any> {
    const d = await this.svc.activeDropForProduct(productId);
    return { drop: d };
  }

  @Post('drop/:dropId/reserve')
  @UseGuards(JwtAuthGuard)
  reserve(@CurrentUser('id') userId: number, @Param('dropId', ParseIntPipe) dropId: number, @Body() body: { quantity?: number }): any {
    return this.svc.reserve(userId, dropId, body?.quantity || 1);
  }

  @Post('reservations/:id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.cancelReservation(userId, id);
  }

  @Get('reservations/mine')
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser('id') userId: number): Promise<any> {
    return { items: await this.svc.listMine(userId) };
  }
}

@Controller('admin/preorder')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class PreorderAdminController {
  constructor(private readonly svc: PreorderService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('drops')
  async drops(): Promise<any> { return { items: await this.svc.listDrops(false) }; }

  @Post('drops')
  createDrop(@Body() body: any): any { return this.svc.createDrop(body); }

  @Put('drops/:id')
  updateDrop(@Param('id', ParseIntPipe) id: number, @Body() body: any): any { return this.svc.updateDrop(id, body); }

  @Post('drops/:id/close')
  closeDrop(@Param('id', ParseIntPipe) id: number): any { return this.svc.closeDrop(id); }

  @Post('drops/:id/go-live')
  goLive(@Param('id', ParseIntPipe) id: number): any { return this.svc.goLive(id); }

  @Post('reservations/:id/confirm-deposit')
  confirmDeposit(@Param('id', ParseIntPipe) id: number): any { return this.svc.confirmDeposit(id); }
}
