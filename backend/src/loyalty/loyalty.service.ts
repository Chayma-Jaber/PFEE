import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoyaltyAccount, LoyaltyTier } from './entities/loyalty-account.entity';
import {
  LoyaltyTransaction,
  TransactionType,
} from './entities/loyalty-transaction.entity';

const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 0,
  [LoyaltyTier.SILVER]: 1000,
  [LoyaltyTier.GOLD]: 5000,
  [LoyaltyTier.PLATINUM]: 15000,
};

const POINTS_TO_CURRENCY = 0.01; // 1 point = 0.01 TND

@Injectable()
export class LoyaltyService {
  constructor(
    @InjectRepository(LoyaltyAccount)
    private readonly accountRepo: Repository<LoyaltyAccount>,
    @InjectRepository(LoyaltyTransaction)
    private readonly transactionRepo: Repository<LoyaltyTransaction>,
  ) {}

  async getOrCreateAccount(userId: number): Promise<LoyaltyAccount> {
    let account = await this.accountRepo.findOne({
      where: { user_id: userId },
    });

    if (!account) {
      account = this.accountRepo.create({
        user_id: userId,
        total_points: 0,
        available_points: 0,
        lifetime_points: 0,
        tier: LoyaltyTier.BRONZE,
      });
      account = await this.accountRepo.save(account);
    }

    return account;
  }

  calculateTier(totalPoints: number): LoyaltyTier {
    if (totalPoints >= TIER_THRESHOLDS[LoyaltyTier.PLATINUM]) {
      return LoyaltyTier.PLATINUM;
    }
    if (totalPoints >= TIER_THRESHOLDS[LoyaltyTier.GOLD]) {
      return LoyaltyTier.GOLD;
    }
    if (totalPoints >= TIER_THRESHOLDS[LoyaltyTier.SILVER]) {
      return LoyaltyTier.SILVER;
    }
    return LoyaltyTier.BRONZE;
  }

  async earnPoints(
    userId: number,
    points: number,
    description: string,
    orderId?: number,
  ): Promise<LoyaltyTransaction> {
    const account = await this.getOrCreateAccount(userId);

    account.total_points += points;
    account.available_points += points;
    account.lifetime_points += points;

    const newTier = this.calculateTier(account.lifetime_points);
    if (newTier !== account.tier) {
      account.tier = newTier;
      account.tier_updated_at = new Date();
    }

    await this.accountRepo.save(account);

    const transaction = this.transactionRepo.create({
      account_id: account.id,
      points,
      type: TransactionType.EARN,
      description,
      order_id: orderId || null,
    });

    return this.transactionRepo.save(transaction);
  }

  async redeemPoints(
    userId: number,
    points: number,
  ): Promise<{
    success: boolean;
    pointsRedeemed: number;
    discountValue: number;
    remainingPoints: number;
  }> {
    const account = await this.getOrCreateAccount(userId);

    if (account.available_points < points) {
      throw new BadRequestException(
        `Insufficient points. Available: ${account.available_points}, requested: ${points}`,
      );
    }

    account.available_points -= points;
    account.total_points -= points;
    await this.accountRepo.save(account);

    const transaction = this.transactionRepo.create({
      account_id: account.id,
      points: -points,
      type: TransactionType.REDEEM,
      description: `Redeemed ${points} points for discount`,
    });
    await this.transactionRepo.save(transaction);

    const discountValue = points * POINTS_TO_CURRENCY;

    return {
      success: true,
      pointsRedeemed: points,
      discountValue,
      remainingPoints: account.available_points,
    };
  }

  async getTransactionHistory(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{ transactions: LoyaltyTransaction[]; total: number }> {
    const account = await this.getOrCreateAccount(userId);

    const [transactions, total] = await this.transactionRepo.findAndCount({
      where: { account_id: account.id },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { transactions, total };
  }

  getTierInfo(): {
    tiers: { name: string; threshold: number; benefits: string[] }[];
  } {
    return {
      tiers: [
        {
          name: LoyaltyTier.BRONZE,
          threshold: TIER_THRESHOLDS[LoyaltyTier.BRONZE],
          benefits: ['Earn 1 point per 1 TND spent', 'Birthday bonus points'],
        },
        {
          name: LoyaltyTier.SILVER,
          threshold: TIER_THRESHOLDS[LoyaltyTier.SILVER],
          benefits: [
            'Earn 1.5 points per 1 TND spent',
            'Birthday bonus points',
            'Early access to sales',
          ],
        },
        {
          name: LoyaltyTier.GOLD,
          threshold: TIER_THRESHOLDS[LoyaltyTier.GOLD],
          benefits: [
            'Earn 2 points per 1 TND spent',
            'Birthday bonus points',
            'Early access to sales',
            'Free shipping on all orders',
          ],
        },
        {
          name: LoyaltyTier.PLATINUM,
          threshold: TIER_THRESHOLDS[LoyaltyTier.PLATINUM],
          benefits: [
            'Earn 3 points per 1 TND spent',
            'Birthday bonus points',
            'Early access to sales',
            'Free shipping on all orders',
            'Exclusive member events',
            'Priority customer support',
          ],
        },
      ],
    };
  }
}
