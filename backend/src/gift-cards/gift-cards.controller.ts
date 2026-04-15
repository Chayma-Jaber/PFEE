import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PurchaseGiftCardDto } from './dto/purchase-gift-card.dto';
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto';
import { ApplyGiftCardDto } from './dto/apply-gift-card.dto';

@Controller('gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Get('check/:code')
  async checkBalance(@Param('code') code: string) {
    return this.giftCardsService.checkBalance(code);
  }

  @Post('purchase')
  @UseGuards(JwtAuthGuard)
  async purchase(
    @CurrentUser() user: any,
    @Body() dto: PurchaseGiftCardDto,
  ) {
    const senderName =
      user.first_name && user.last_name
        ? `${user.first_name} ${user.last_name}`
        : user.email;
    const card = await this.giftCardsService.purchaseGiftCard(
      user.id,
      dto,
      senderName,
    );
    return {
      success: true,
      giftCard: {
        id: card.id,
        code: card.code,
        amount: Number(card.amount),
        recipientEmail: card.recipient_email,
        recipientName: card.recipient_name,
        expiresAt: card.expires_at,
      },
    };
  }

  @Get('my-cards')
  @UseGuards(JwtAuthGuard)
  async getMyCards(@CurrentUser('id') userId: number) {
    const cards = await this.giftCardsService.getUserGiftCards(userId);
    return {
      cards: cards.map((card) => ({
        id: card.id,
        code: card.code,
        amount: Number(card.amount),
        balance: Number(card.balance),
        recipientEmail: card.recipient_email,
        recipientName: card.recipient_name,
        isActive: card.is_active,
        isRedeemed: card.is_redeemed,
        purchasedAt: card.purchased_at,
        expiresAt: card.expires_at,
      })),
    };
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeem(
    @CurrentUser('id') userId: number,
    @Body() dto: RedeemGiftCardDto,
  ) {
    return this.giftCardsService.redeemGiftCard(userId, dto.code);
  }

  @Get('my-balance')
  @UseGuards(JwtAuthGuard)
  async getMyBalance(@CurrentUser('id') userId: number) {
    return this.giftCardsService.getUserBalance(userId);
  }

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  async apply(
    @CurrentUser('id') userId: number,
    @Body() dto: ApplyGiftCardDto,
  ) {
    return this.giftCardsService.applyToOrder(
      userId,
      dto.code,
      dto.orderId,
      dto.amount,
    );
  }
}
