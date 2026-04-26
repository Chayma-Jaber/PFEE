import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { B2BService } from './b2b.service';

@Controller('storefront/b2b')
@UseGuards(JwtAuthGuard)
@SkipTransform()
export class B2BStorefrontController {
  constructor(private readonly svc: B2BService) {}

  @Post('apply') apply(@CurrentUser('id') userId: number, @Body() body: any): any { return this.svc.apply(userId, body); }
  @Get('me') async me(@CurrentUser('id') userId: number): Promise<any> { return { account: await this.svc.getMine(userId) }; }
  @Get('price-list') async priceList(@CurrentUser('id') userId: number): Promise<any> { return { items: await this.svc.priceList(userId) }; }
  @Post('quotes') createQuote(
    @CurrentUser('id') userId: number,
    @Body() body: { items: Array<{ productId: number; quantity: number }>; notes?: string },
  ): any { return this.svc.createQuote(userId, body?.items || [], body?.notes); }
  @Get('quotes') async myQuotes(@CurrentUser('id') userId: number): Promise<any> {
    return { items: await this.svc.listMyQuotes(userId) };
  }
}

@Controller('admin/b2b')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class B2BAdminController {
  constructor(private readonly svc: B2BService) {}

  @Get('stats') stats(): any { return this.svc.stats(); }

  @Get('accounts')
  async accounts(@Query('status') status?: string): Promise<any> {
    return { items: await this.svc.adminList(status) };
  }

  @Post('accounts/:id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number, @Body() body: any): any {
    return this.svc.approveAccount(id, adminId, body || {});
  }

  @Get('quotes')
  async quotes(@Query('status') status?: string): Promise<any> {
    return { items: await this.svc.adminListQuotes(status) };
  }

  @Post('quotes/:id/approve')
  approveQuote(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number, @Body() body: any): any {
    return this.svc.reviewQuote(id, adminId, 'APPROVE', body);
  }

  @Post('quotes/:id/reject')
  rejectQuote(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') adminId: number, @Body() body: any): any {
    return this.svc.reviewQuote(id, adminId, 'REJECT', body);
  }
}
