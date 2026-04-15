import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { SubscribeDto, UnsubscribeDto, UpdatePreferencesDto } from './dto/newsletter.dto';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  async subscribe(@Body() dto: SubscribeDto) {
    return this.newsletterService.subscribe(dto);
  }

  @Get('confirm/:token')
  async confirmSubscription(@Param('token') token: string) {
    return this.newsletterService.confirmSubscription(token);
  }

  @Post('unsubscribe')
  async unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.newsletterService.unsubscribe(dto);
  }

  @Put('preferences')
  async updatePreferences(@Body() dto: UpdatePreferencesDto) {
    return this.newsletterService.updatePreferences(dto);
  }

  @Get('status/:email')
  async getStatus(@Param('email') email: string) {
    return this.newsletterService.getStatus(email);
  }
}
