import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { LoyaltyAccount, LoyaltyTier } from '../loyalty/entities/loyalty-account.entity';
import { LoyaltyTransaction, TransactionType } from '../loyalty/entities/loyalty-transaction.entity';

@Controller('admin/loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminLoyaltyController {
  constructor(
    @InjectRepository(LoyaltyAccount) private readonly accountRepo: Repository<LoyaltyAccount>,
    @InjectRepository(LoyaltyTransaction) private readonly txRepo: Repository<LoyaltyTransaction>,
  ) {}

  @Get('stats')
  async stats() {
    const totalAccounts = await this.accountRepo.count();
    const bronze = await this.accountRepo.count({ where: { tier: LoyaltyTier.BRONZE } });
    const silver = await this.accountRepo.count({ where: { tier: LoyaltyTier.SILVER } });
    const gold = await this.accountRepo.count({ where: { tier: LoyaltyTier.GOLD } });
    const platinum = await this.accountRepo.count({ where: { tier: LoyaltyTier.PLATINUM } });
    const totals = await this.accountRepo
      .createQueryBuilder('a')
      .select('SUM(a.available_points)', 'available')
      .addSelect('SUM(a.lifetime_points)', 'lifetime')
      .getRawOne();
    return {
      totalAccounts,
      byTier: { bronze, silver, gold, platinum },
      totalAvailablePoints: Number(totals?.available || 0),
      totalLifetimePoints: Number(totals?.lifetime || 0),
    };
  }

  @Get('accounts')
  async listAccounts(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
  ) {
    const qb = this.accountRepo.createQueryBuilder('a')
      .leftJoinAndSelect('a.user', 'u')
      .orderBy('a.lifetime_points', 'DESC');

    if (tier) qb.andWhere('a.tier = :tier', { tier: tier.toUpperCase() });
    if (search) qb.andWhere('(u.email LIKE :s OR u.first_name LIKE :s OR u.last_name LIKE :s)', { s: `%${search}%` });

    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * limit).take(limit).getMany();

    const items = rows.map((a) => ({
      id: a.id,
      userId: a.user_id,
      userName: a.user ? `${a.user.first_name || ''} ${a.user.last_name || ''}`.trim() : '—',
      userEmail: a.user?.email,
      totalPoints: a.total_points,
      availablePoints: a.available_points,
      lifetimePoints: a.lifetime_points,
      tier: a.tier,
      createdAt: a.created_at,
    }));
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  @Get('accounts/:id/transactions')
  async accountTransactions(@Param('id', ParseIntPipe) id: number) {
    const txs = await this.txRepo.find({ where: { account_id: id }, order: { created_at: 'DESC' }, take: 50 });
    return { items: txs };
  }

  @Post('accounts/:id/adjust')
  async adjustPoints(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { points: number; reason?: string },
  ) {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Compte fidélité introuvable');

    const points = Number(body.points);
    if (!points || isNaN(points)) throw new BadRequestException('Nombre de points invalide');

    account.available_points = Math.max(0, account.available_points + points);
    account.total_points = Math.max(0, account.total_points + points);
    if (points > 0) {
      account.lifetime_points = account.lifetime_points + points;
    }

    await this.accountRepo.save(account);

    const tx = this.txRepo.create({
      account_id: id,
      points,
      type: TransactionType.ADJUST,
      description: body.reason || 'Ajustement administratif',
    });
    await this.txRepo.save(tx);

    // Re-evaluate tier
    this.updateTier(account);
    await this.accountRepo.save(account);

    return { success: true, account };
  }

  @Post('accounts/:id/tier')
  async setTier(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { tier: string },
  ) {
    const account = await this.accountRepo.findOne({ where: { id } });
    if (!account) throw new NotFoundException('Compte fidélité introuvable');

    const validTiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];
    const tier = (body.tier || '').toUpperCase();
    if (!validTiers.includes(tier)) throw new BadRequestException('Niveau invalide');

    account.tier = tier as LoyaltyTier;
    account.tier_updated_at = new Date();
    await this.accountRepo.save(account);
    return { success: true, tier: account.tier };
  }

  private updateTier(account: LoyaltyAccount) {
    const lp = account.lifetime_points;
    const prev = account.tier;
    if (lp >= 10000) account.tier = LoyaltyTier.PLATINUM;
    else if (lp >= 5000) account.tier = LoyaltyTier.GOLD;
    else if (lp >= 2000) account.tier = LoyaltyTier.SILVER;
    else account.tier = LoyaltyTier.BRONZE;
    if (prev !== account.tier) account.tier_updated_at = new Date();
  }
}
