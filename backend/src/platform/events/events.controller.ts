import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SkipTransform } from '../../common/decorators/skip-transform.decorator';
import { EventBusService } from './event-bus.service';

@Controller('admin/events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class EventsAdminController {
  constructor(private readonly bus: EventBusService) {}

  @Get('stats')
  stats() { return this.bus.stats(); }

  @Get('recent')
  async recent(
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
    @Query('type') type?: string,
    @Query('aggregateId') aggregateId?: string,
  ) {
    return { items: await this.bus.listRecent({ limit, type, aggregateId }) };
  }
}
