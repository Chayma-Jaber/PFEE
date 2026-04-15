import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ApplyReferralDto } from './dto/apply-referral.dto';

@Controller('referrals')
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  @Get('my-code')
  @UseGuards(JwtAuthGuard)
  async getMyCode(@CurrentUser('id') userId: number) {
    const { code, referral } =
      await this.referralsService.generateReferralCode(userId);
    return {
      code,
      expiresAt: referral.expires_at,
      rewardType: referral.reward_type,
      rewardAmount: Number(referral.reward_amount),
      referrerRewardAmount: Number(referral.referrer_reward_amount),
    };
  }

  @Post('apply')
  @UseGuards(JwtAuthGuard)
  async applyReferral(
    @CurrentUser('id') userId: number,
    @Body() dto: ApplyReferralDto,
  ) {
    return this.referralsService.applyReferral(userId, dto.code);
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  async getEarnings(@CurrentUser('id') userId: number) {
    return this.referralsService.getEarnings(userId);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(@CurrentUser('id') userId: number) {
    const referrals = await this.referralsService.getHistory(userId);
    return {
      referrals: referrals.map((r) => ({
        id: r.id,
        referralCode: r.referral_code,
        referredEmail: r.referred_email,
        status: r.status,
        rewardType: r.reward_type,
        rewardAmount: Number(r.reward_amount),
        referrerRewardAmount: Number(r.referrer_reward_amount),
        isRewardClaimed: r.is_reward_claimed,
        createdAt: r.created_at,
        completedAt: r.completed_at,
        expiresAt: r.expires_at,
      })),
    };
  }
}
