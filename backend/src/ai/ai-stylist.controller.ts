import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { AiStylistService, StylistRequest, StylistReply } from './ai-stylist.service';

@Controller('ai/stylist')
@SkipTransform()
export class AiStylistController {
  constructor(private readonly svc: AiStylistService) {}

  @Post('chat')
  @UseGuards(OptionalAuthGuard)
  async chat(
    @CurrentUser('id') userId: number | null,
    @Body() body: Omit<StylistRequest, 'userId'>,
  ): Promise<StylistReply> {
    return this.svc.chat({
      userId: userId ?? null,
      message: (body.message || '').slice(0, 1000),
      history: (body.history || []).slice(-10),
      context: body.context,
    });
  }
}
