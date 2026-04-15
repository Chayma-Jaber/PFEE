import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GiftCard } from './entities/gift-card.entity';
import { StoreCredit } from './entities/store-credit.entity';
import { PurchaseGiftCardDto } from './dto/purchase-gift-card.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class GiftCardsService {
  constructor(
    @InjectRepository(GiftCard)
    private readonly giftCardRepo: Repository<GiftCard>,
    @InjectRepository(StoreCredit)
    private readonly storeCreditRepo: Repository<StoreCredit>,
  ) {}

  generateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(16);
    let code = '';
    for (let i = 0; i < 16; i++) {
      code += chars[bytes[i] % chars.length];
    }
    // Format as XXXX-XXXX-XXXX-XXXX
    return `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8, 12)}-${code.slice(12, 16)}`;
  }

  async purchaseGiftCard(
    userId: number,
    dto: PurchaseGiftCardDto,
    senderName?: string,
  ): Promise<GiftCard> {
    let code: string;
    let exists = true;

    // Ensure unique code
    while (exists) {
      code = this.generateCode();
      const existing = await this.giftCardRepo.findOne({ where: { code } });
      exists = !!existing;
    }

    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const giftCard = this.giftCardRepo.create({
      code,
      amount: dto.amount,
      balance: dto.amount,
      currency: 'TND',
      sender_id: userId,
      recipient_email: dto.recipientEmail,
      recipient_name: dto.recipientName,
      sender_name: senderName || null,
      message: dto.message || null,
      is_active: true,
      is_redeemed: false,
      purchased_at: new Date(),
      expires_at: expiresAt,
    });

    return this.giftCardRepo.save(giftCard);
  }

  async checkBalance(code: string): Promise<{
    code: string;
    balance: number;
    currency: string;
    isActive: boolean;
    expiresAt: Date;
  }> {
    const card = await this.giftCardRepo.findOne({ where: { code } });
    if (!card) {
      throw new NotFoundException('Gift card not found');
    }

    return {
      code: card.code,
      balance: Number(card.balance),
      currency: card.currency,
      isActive: card.is_active && !card.is_redeemed && new Date() < card.expires_at,
      expiresAt: card.expires_at,
    };
  }

  async getUserGiftCards(userId: number): Promise<GiftCard[]> {
    return this.giftCardRepo.find({
      where: { sender_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getOrCreateStoreCredit(userId: number): Promise<StoreCredit> {
    let credit = await this.storeCreditRepo.findOne({
      where: { user_id: userId },
    });

    if (!credit) {
      credit = this.storeCreditRepo.create({
        user_id: userId,
        balance: 0,
        currency: 'TND',
      });
      credit = await this.storeCreditRepo.save(credit);
    }

    return credit;
  }

  async redeemGiftCard(
    userId: number,
    code: string,
  ): Promise<{
    success: boolean;
    amount: number;
    newBalance: number;
  }> {
    const card = await this.giftCardRepo.findOne({ where: { code } });

    if (!card) {
      throw new NotFoundException('Gift card not found');
    }

    if (!card.is_active) {
      throw new BadRequestException('Gift card is no longer active');
    }

    if (card.is_redeemed) {
      throw new BadRequestException('Gift card has already been redeemed');
    }

    if (card.expires_at && new Date() > card.expires_at) {
      throw new BadRequestException('Gift card has expired');
    }

    const cardBalance = Number(card.balance);

    // Mark gift card as redeemed
    card.is_redeemed = true;
    card.redeemed_at = new Date();
    card.redeemed_by = userId;
    card.balance = 0;
    await this.giftCardRepo.save(card);

    // Add to store credit
    const storeCredit = await this.getOrCreateStoreCredit(userId);
    storeCredit.balance = Number(storeCredit.balance) + cardBalance;
    await this.storeCreditRepo.save(storeCredit);

    return {
      success: true,
      amount: cardBalance,
      newBalance: storeCredit.balance,
    };
  }

  async getUserBalance(
    userId: number,
  ): Promise<{ balance: number; currency: string }> {
    const credit = await this.getOrCreateStoreCredit(userId);
    return {
      balance: Number(credit.balance),
      currency: credit.currency,
    };
  }

  async applyToOrder(
    userId: number,
    code: string,
    orderId: number,
    amount: number,
  ): Promise<{
    success: boolean;
    amountApplied: number;
    remainingBalance: number;
  }> {
    const card = await this.giftCardRepo.findOne({ where: { code } });

    if (!card) {
      throw new NotFoundException('Gift card not found');
    }

    if (!card.is_active) {
      throw new BadRequestException('Gift card is no longer active');
    }

    if (card.is_redeemed) {
      throw new BadRequestException('Gift card has already been fully redeemed');
    }

    if (card.expires_at && new Date() > card.expires_at) {
      throw new BadRequestException('Gift card has expired');
    }

    const cardBalance = Number(card.balance);
    const amountToApply = Math.min(amount, cardBalance);

    card.balance = cardBalance - amountToApply;
    if (card.balance <= 0) {
      card.is_redeemed = true;
      card.redeemed_at = new Date();
      card.redeemed_by = userId;
    }
    await this.giftCardRepo.save(card);

    return {
      success: true,
      amountApplied: amountToApply,
      remainingBalance: Number(card.balance),
    };
  }
}
