import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto, VoteReviewDto, ReviewQueryDto } from './dto/create-review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('product/:productId')
  async getProductReviews(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: ReviewQueryDto,
  ) {
    return this.reviewsService.getProductReviews(productId, query);
  }

  @Get('product/:productId/stats')
  async getProductReviewStats(
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.reviewsService.getProductReviewStats(productId);
  }

  @Get('user/can-review/:productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async canReview(
    @CurrentUser('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    return this.reviewsService.canUserReview(userId, productId);
  }

  @Get('user/my-reviews')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async getMyReviews(
    @CurrentUser('id') userId: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reviewsService.getUserReviews(userId, page || 1, limit || 10);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async createReview(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviewsService.createReview(userId, dto);
  }

  @Post(':id/vote')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async voteReview(
    @Param('id', ParseIntPipe) reviewId: number,
    @CurrentUser('id') userId: number,
    @Body() dto: VoteReviewDto,
  ) {
    return this.reviewsService.voteReview(reviewId, userId, dto.isHelpful);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  async deleteReview(
    @Param('id', ParseIntPipe) reviewId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.reviewsService.deleteReview(reviewId, userId);
  }
}
