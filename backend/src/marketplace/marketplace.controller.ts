import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { MarketplaceService } from './marketplace.service';

@Controller('storefront/seller')
@UseGuards(JwtAuthGuard)
@SkipTransform()
export class SellerStorefrontController {
  constructor(private readonly svc: MarketplaceService) {}

  @Post('apply')
  apply(@CurrentUser('id') userId: number, @Body() body: any): any {
    return this.svc.apply(userId, body);
  }

  @Get('me')
  async me(@CurrentUser('id') userId: number): Promise<any> {
    return { seller: await this.svc.getMine(userId) };
  }

  @Put('me')
  updateMe(@CurrentUser('id') userId: number, @Body() body: any): any {
    return this.svc.updateMine(userId, body);
  }

  @Get('me/payouts')
  async myPayouts(@CurrentUser('id') userId: number): Promise<any> {
    const s = await this.svc.getMine(userId);
    if (!s) return { items: [] };
    return { items: await this.svc.listPayoutsForSeller(s.id) };
  }
}

@Controller('admin/marketplace')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class MarketplaceAdminController {
  constructor(private readonly svc: MarketplaceService) {}

  @Get('stats')
  stats(): any { return this.svc.stats(); }

  @Get('sellers')
  async sellers(@Query('status') status?: string): Promise<any> {
    return { items: await this.svc.adminList(status) };
  }

  @Post('sellers/:id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() body: { commissionPct?: number },
  ): any {
    return this.svc.approve(id, adminId, body?.commissionPct);
  }

  @Post('sellers/:id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() body: { reason: string },
  ): any {
    return this.svc.reject(id, adminId, body?.reason || 'unspecified');
  }

  @Post('sellers/:id/suspend')
  suspend(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') adminId: number,
    @Body() body: { reason: string },
  ): any {
    return this.svc.suspend(id, adminId, body?.reason || 'unspecified');
  }

  @Post('sellers/:id/compute-payout')
  computePayout(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { periodStart: string; periodEnd: string },
  ): any {
    return this.svc.computePayout(id, new Date(body.periodStart), new Date(body.periodEnd));
  }

  @Get('payouts')
  async payouts(@Query('status') status?: string): Promise<any> {
    return { items: await this.svc.listAllPayouts(status) };
  }

  @Post('payouts/:id/mark-paid')
  markPaid(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reference: string },
  ): any {
    return this.svc.markPaid(id, body?.reference || '');
  }
}
