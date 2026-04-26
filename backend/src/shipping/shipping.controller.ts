import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { ShippingService } from './shipping.service';
import { ShipmentStatus } from './entities/shipment.entity';

@Controller()
@SkipTransform()
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  // ═══ PUBLIC track-by-number (no auth — customer uses tracking # from email) ═══
  @Get('shipping/track/:trackingNumber')
  async publicTrack(@Param('trackingNumber') tn: string) {
    const s = await this.shipping.getByTracking(tn);
    return {
      trackingNumber: s.tracking_number,
      provider: s.provider,
      status: s.status,
      events: s.events || [],
      estimatedDeliveryAt: s.estimated_delivery_at,
      recipientCity: s.recipient_city,
    };
  }

  @Get('shipping/providers')
  async listProviders() {
    return { providers: this.shipping.listProviders() };
  }

  @Get('shipping/estimate')
  async estimate(@Query('city') city: string, @Query('weight') weightRaw?: string) {
    const weight = weightRaw ? Number(weightRaw) : 1;
    return { estimates: await this.shipping.estimateAll(city || '', weight) };
  }

  // ═══ ADMIN SHIPMENT MANAGEMENT ════════════════════════════════════════
  @Get('admin/shipments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async adminList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('provider') provider?: string,
  ) {
    return this.shipping.list({ page, limit, status, provider });
  }

  @Get('admin/shipments/by-order/:orderId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async adminByOrder(@Param('orderId', ParseIntPipe) orderId: number) {
    const s = await this.shipping.getByOrder(orderId);
    return { shipment: s };
  }

  @Post('admin/shipments')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async adminCreate(@Body() body: { orderId: number; provider: string; weightKg?: number; note?: string }) {
    if (!body?.orderId || !body?.provider) throw new BadRequestException('orderId + provider requis');
    return this.shipping.create(body.orderId, body.provider, { weightKg: body.weightKg, note: body.note });
  }

  @Post('admin/shipments/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async adminPushStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: ShipmentStatus; note?: string; location?: string },
  ) {
    if (!body?.status) throw new BadRequestException('status required');
    return this.shipping.pushEvent(id, body.status, { note: body.note, location: body.location });
  }

  @Post('admin/shipments/:id/sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async adminSync(@Param('id', ParseIntPipe) id: number) {
    return this.shipping.syncFromProvider(id);
  }

  @Post('admin/shipments/:id/cancel')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async adminCancel(@Param('id', ParseIntPipe) id: number) {
    return this.shipping.cancel(id);
  }
}
