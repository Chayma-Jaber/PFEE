import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { AnalyticsService } from './analytics.service';
import { TrackEventDto, BatchTrackDto } from './dto/analytics.dto';

/**
 * Optional JWT guard - does not throw if no token provided.
 * Attaches user to request if a valid JWT is present.
 */
class OptionalJwtGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: TUser): TUser | null {
    return user || null;
  }
}

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('event')
  @UseGuards(OptionalJwtGuard)
  @ApiBearerAuth('access-token')
  async trackEvent(@Body() dto: TrackEventDto, @Req() req: Request) {
    const userId = (req as any).user?.id || null;
    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    return this.analyticsService.trackEvent(dto, userId, ipAddress, userAgent);
  }

  @Post('track/batch')
  @UseGuards(OptionalJwtGuard)
  @ApiBearerAuth('access-token')
  async trackBatch(@Body() dto: BatchTrackDto, @Req() req: Request) {
    const userId = (req as any).user?.id || null;
    const ipAddress = req.ip || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    return this.analyticsService.trackBatchEvents(
      dto.events,
      userId,
      ipAddress,
      userAgent,
    );
  }
}
