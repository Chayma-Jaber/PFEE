import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RedeemPointsDto } from './dto/redeem-points.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('account')
  @UseGuards(JwtAuthGuard)
  async getAccount(@CurrentUser('id') userId: number) {
    const account = await this.loyaltyService.getOrCreateAccount(userId);
    return {
      id: account.id,
      totalPoints: account.total_points,
      availablePoints: account.available_points,
      lifetimePoints: account.lifetime_points,
      tier: account.tier,
      tierUpdatedAt: account.tier_updated_at,
      createdAt: account.created_at,
    };
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  async getHistory(
    @CurrentUser('id') userId: number,
    @Query() query: PaginationQueryDto,
  ) {
    const { transactions, total } =
      await this.loyaltyService.getTransactionHistory(
        userId,
        query.page,
        query.limit,
      );

    return {
      transactions,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeemPoints(
    @CurrentUser('id') userId: number,
    @Body() dto: RedeemPointsDto,
  ) {
    return this.loyaltyService.redeemPoints(userId, dto.points);
  }

  @Get('tiers')
  getTiers() {
    return this.loyaltyService.getTierInfo();
  }
}
