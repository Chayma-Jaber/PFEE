import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { GiftCard } from '../gift-cards/entities/gift-card.entity';

@Controller('admin/gift-cards')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminGiftCardsController {
  constructor(
    @InjectRepository(GiftCard)
    private readonly giftCardRepo: Repository<GiftCard>,
  ) {}

  // ─── List Gift Cards ───────────────────────────────────────────────

  @Get()
  async getGiftCards(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const qb = this.giftCardRepo
      .createQueryBuilder('gc')
      .orderBy('gc.created_at', 'DESC');

    if (search) {
      qb.andWhere(
        '(gc.code LIKE :search OR gc.recipient_email LIKE :search OR gc.recipient_name LIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status === 'active') {
      qb.andWhere('gc.is_active = :active', { active: true });
    } else if (status === 'redeemed') {
      qb.andWhere('gc.is_redeemed = :redeemed', { redeemed: true });
    } else if (status === 'expired') {
      qb.andWhere('gc.expires_at < :now', { now: new Date() });
    }

    const total = await qb.getCount();
    const data = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  // ─── Stats ─────────────────────────────────────────────────────────

  @Get('stats')
  async getStats() {
    const result = await this.giftCardRepo
      .createQueryBuilder('gc')
      .select('COUNT(gc.id)', 'total_issued')
      .addSelect('COALESCE(SUM(gc.amount), 0)', 'total_value')
      .addSelect('COALESCE(SUM(gc.amount) - SUM(gc.balance), 0)', 'total_redeemed')
      .addSelect(
        "SUM(CASE WHEN gc.is_active = 1 AND gc.balance > 0 THEN 1 ELSE 0 END)",
        'total_active',
      )
      .getRawOne();

    return {
      total_issued: parseInt(result.total_issued, 10),
      total_value: parseFloat(result.total_value) || 0,
      total_redeemed: parseFloat(result.total_redeemed) || 0,
      total_active: parseInt(result.total_active, 10) || 0,
    };
  }

  // ─── Single Gift Card ──────────────────────────────────────────────

  @Get(':id')
  async getGiftCard(@Param('id', ParseIntPipe) id: number) {
    const gc = await this.giftCardRepo.findOne({ where: { id } });
    if (!gc) throw new NotFoundException('Gift card not found');
    return gc;
  }

  // ─── Create Gift Card ──────────────────────────────────────────────

  @Post()
  async createGiftCard(
    @Body()
    body: {
      amount: number;
      recipient_email: string;
      recipient_name: string;
      sender_name?: string;
      message?: string;
      expires_at?: string;
    },
  ) {
    const code = this.generateCode();
    const gc = this.giftCardRepo.create({
      code,
      amount: body.amount,
      balance: body.amount,
      recipient_email: body.recipient_email,
      recipient_name: body.recipient_name,
      sender_name: body.sender_name || 'Admin',
      message: body.message,
      is_active: true,
      is_redeemed: false,
      purchased_at: new Date(),
      expires_at: body.expires_at ? new Date(body.expires_at) : null,
    });
    return this.giftCardRepo.save(gc);
  }

  // ─── Update Gift Card ──────────────────────────────────────────────

  @Put(':id')
  async updateGiftCard(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<GiftCard>,
  ) {
    const gc = await this.giftCardRepo.findOne({ where: { id } });
    if (!gc) throw new NotFoundException('Gift card not found');

    // Only allow updating certain fields
    if (body.is_active !== undefined) gc.is_active = body.is_active;
    if (body.recipient_email) gc.recipient_email = body.recipient_email;
    if (body.recipient_name) gc.recipient_name = body.recipient_name;
    if (body.message !== undefined) gc.message = body.message;
    if ((body as any).expires_at) gc.expires_at = new Date((body as any).expires_at);

    return this.giftCardRepo.save(gc);
  }

  // ─── Transactions (usage history) ──────────────────────────────────

  @Get(':id/transactions')
  async getTransactions(@Param('id', ParseIntPipe) id: number) {
    const gc = await this.giftCardRepo.findOne({ where: { id } });
    if (!gc) throw new NotFoundException('Gift card not found');

    // No separate transaction entity exists, so return derived data
    const transactions: any[] = [];

    if (gc.purchased_at) {
      transactions.push({
        id: 1,
        type: 'ISSUED',
        amount: gc.amount,
        balance_after: gc.amount,
        description: `Gift card issued to ${gc.recipient_name}`,
        created_at: gc.purchased_at || gc.created_at,
      });
    }

    if (gc.is_redeemed && gc.redeemed_at) {
      const used = Number(gc.amount) - Number(gc.balance);
      transactions.push({
        id: 2,
        type: 'REDEEMED',
        amount: -used,
        balance_after: Number(gc.balance),
        description: 'Gift card redeemed',
        created_at: gc.redeemed_at,
      });
    }

    return transactions;
  }

  // ─── Adjust Balance ────────────────────────────────────────────────

  @Post(':id/adjust')
  async adjustBalance(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { amount: number; reason?: string },
  ) {
    const gc = await this.giftCardRepo.findOne({ where: { id } });
    if (!gc) throw new NotFoundException('Gift card not found');

    gc.balance = Number(gc.balance) + body.amount;
    if (gc.balance < 0) gc.balance = 0;

    return this.giftCardRepo.save(gc);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const segments = 4;
    const segLen = 4;
    const parts: string[] = [];
    for (let s = 0; s < segments; s++) {
      let part = '';
      for (let i = 0; i < segLen; i++) {
        part += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      parts.push(part);
    }
    return parts.join('-');
  }
}
