import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Referral,
  ReferralStatus,
  RewardType,
} from './entities/referral.entity';
import { randomBytes } from 'crypto';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private readonly referralRepo: Repository<Referral>,
  ) {}

  async generateReferralCode(userId: number): Promise<{
    code: string;
    referral: Referral;
  }> {
    // Check if user already has a referral code entry that is still pending (reusable)
    let existing = await this.referralRepo.findOne({
      where: {
        referrer_id: userId,
        status: ReferralStatus.PENDING,
        referred_user_id: null as any,
      },
    });

    if (existing) {
      return { code: existing.referral_code, referral: existing };
    }

    // Generate a unique code
    let code: string;
    let codeExists = true;

    while (codeExists) {
      const bytes = randomBytes(4);
      code = `REF-${bytes.toString('hex').toUpperCase().slice(0, 8)}`;
      const found = await this.referralRepo.findOne({
        where: { referral_code: code },
      });
      codeExists = !!found;
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90 days expiry

    const referral = this.referralRepo.create({
      referrer_id: userId,
      referral_code: code,
      status: ReferralStatus.PENDING,
      reward_type: RewardType.POINTS,
      reward_amount: 500,
      referrer_reward_amount: 500,
      is_reward_claimed: false,
      expires_at: expiresAt,
    });

    const saved = await this.referralRepo.save(referral);
    return { code: saved.referral_code, referral: saved };
  }

  async applyReferral(
    userId: number,
    code: string,
  ): Promise<{
    success: boolean;
    message: string;
    rewardType: RewardType;
    rewardAmount: number;
  }> {
    const referral = await this.referralRepo.findOne({
      where: { referral_code: code },
    });

    if (!referral) {
      throw new NotFoundException('Referral code not found');
    }

    if (referral.referrer_id === userId) {
      throw new BadRequestException('You cannot use your own referral code');
    }

    if (referral.status !== ReferralStatus.PENDING) {
      throw new BadRequestException('This referral code has already been used');
    }

    if (referral.expires_at && new Date() > referral.expires_at) {
      referral.status = ReferralStatus.EXPIRED;
      await this.referralRepo.save(referral);
      throw new BadRequestException('This referral code has expired');
    }

    // Check if user was already referred
    const alreadyReferred = await this.referralRepo.findOne({
      where: { referred_user_id: userId },
    });

    if (alreadyReferred) {
      throw new ConflictException('You have already used a referral code');
    }

    referral.referred_user_id = userId;
    referral.status = ReferralStatus.SIGNED_UP;
    await this.referralRepo.save(referral);

    return {
      success: true,
      message: 'Referral code applied successfully. Complete your first purchase to earn rewards.',
      rewardType: referral.reward_type,
      rewardAmount: Number(referral.reward_amount),
    };
  }

  async completeReferral(referralId: number): Promise<Referral> {
    const referral = await this.referralRepo.findOne({
      where: { id: referralId },
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    if (
      referral.status !== ReferralStatus.SIGNED_UP &&
      referral.status !== ReferralStatus.FIRST_PURCHASE
    ) {
      throw new BadRequestException(
        'Referral is not in a completable state',
      );
    }

    referral.status = ReferralStatus.COMPLETED;
    referral.completed_at = new Date();
    referral.is_reward_claimed = true;

    return this.referralRepo.save(referral);
  }

  async getEarnings(userId: number): Promise<{
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    totalEarned: number;
    rewardType: string;
  }> {
    const referrals = await this.referralRepo.find({
      where: { referrer_id: userId },
    });

    const completed = referrals.filter(
      (r) => r.status === ReferralStatus.COMPLETED,
    );
    const pending = referrals.filter(
      (r) =>
        r.status === ReferralStatus.PENDING ||
        r.status === ReferralStatus.SIGNED_UP ||
        r.status === ReferralStatus.FIRST_PURCHASE,
    );

    const totalEarned = completed.reduce(
      (sum, r) => sum + Number(r.referrer_reward_amount),
      0,
    );

    return {
      totalReferrals: referrals.length,
      completedReferrals: completed.length,
      pendingReferrals: pending.length,
      totalEarned,
      rewardType: RewardType.POINTS,
    };
  }

  async getHistory(userId: number): Promise<Referral[]> {
    return this.referralRepo.find({
      where: { referrer_id: userId },
      order: { created_at: 'DESC' },
    });
  }
}
