import { Body, Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { SubscriptionsService } from './subscriptions.service';

@Controller('storefront/subscriptions')
@SkipTransform()
export class SubscriptionsStorefrontController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async mine(@CurrentUser('id') userId: number): Promise<any> {
    return { items: await this.svc.listForUser(userId) };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @CurrentUser('id') userId: number,
    @Body() body: { productId: number; quantity?: number; frequencyDays: number; shippingAddressId?: number; paymentMethodId?: number },
  ): any {
    return this.svc.create(userId, body);
  }

  @Post(':id/pause')
  @UseGuards(JwtAuthGuard)
  pause(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { until?: string },
  ): any {
    return this.svc.pause(userId, id, body?.until);
  }

  @Post(':id/resume')
  @UseGuards(JwtAuthGuard)
  resume(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.resume(userId, id);
  }

  @Post(':id/skip')
  @UseGuards(JwtAuthGuard)
  skip(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.skipNext(userId, id);
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancel(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: string },
  ): any {
    return this.svc.cancel(userId, id, body?.reason);
  }
}

@Controller('admin/subscriptions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class SubscriptionsAdminController {
  constructor(private readonly svc: SubscriptionsService) {}

  @Get('stats')
  stats(): any { return this.svc.stats(); }

  @Get()
  async list(
    @Query('status') status?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ): Promise<any> {
    return { items: await this.svc.adminList(status, limit) };
  }

  @Post('process-due')
  processDue(@Body() body: { limit?: number } = {}): any {
    return this.svc.processDue(body?.limit || 100);
  }
}
