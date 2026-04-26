import {
  Controller,
  Get,
  Post,
  Delete,
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

import { ProductReview } from '../reviews/entities/product-review.entity';

@Controller('admin/reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminReviewsController {
  constructor(
    @InjectRepository(ProductReview)
    private readonly reviewRepo: Repository<ProductReview>,
  ) {}

  @Get()
  async list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('rating') rating?: string,
    @Query('search') search?: string,
  ) {
    const qb = this.reviewRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .orderBy('r.created_at', 'DESC');

    if (status === 'approved') qb.andWhere('r.is_approved = :v', { v: true });
    if (status === 'pending') qb.andWhere('r.is_approved = :v', { v: false });
    if (rating) qb.andWhere('r.rating = :rt', { rt: Number(rating) });
    if (search) {
      qb.andWhere('(r.title LIKE :s OR r.comment LIKE :s)', { s: `%${search}%` });
    }

    const total = await qb.getCount();
    const rows = await qb.skip((page - 1) * limit).take(limit).getMany();

    const items = rows.map((r) => ({
      id: r.id,
      productId: r.product_id,
      userId: r.user_id,
      userName: r.user ? `${r.user.first_name || ''} ${r.user.last_name || ''}`.trim() : '—',
      userEmail: r.user?.email,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      isVerifiedPurchase: r.is_verified_purchase,
      isApproved: r.is_approved,
      isRecommended: r.is_recommended,
      helpfulCount: r.helpful_count,
      notHelpfulCount: r.not_helpful_count,
      createdAt: r.created_at,
    }));

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  @Get('stats')
  async stats() {
    const total = await this.reviewRepo.count();
    const approved = await this.reviewRepo.count({ where: { is_approved: true } });
    const pending = await this.reviewRepo.count({ where: { is_approved: false } });
    const avg = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(CAST(r.rating AS FLOAT))', 'avg')
      .getRawOne();
    const fiveStars = await this.reviewRepo.count({ where: { rating: 5 } });
    const oneStars = await this.reviewRepo.count({ where: { rating: 1 } });
    return {
      total,
      approved,
      pending,
      averageRating: avg?.avg ? Math.round(parseFloat(avg.avg) * 10) / 10 : 0,
      fiveStars,
      oneStars,
    };
  }

  @Post(':id/approve')
  async approve(@Param('id', ParseIntPipe) id: number) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    review.is_approved = true;
    await this.reviewRepo.save(review);
    return { id, isApproved: true };
  }

  @Post(':id/reject')
  async reject(@Param('id', ParseIntPipe) id: number) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    review.is_approved = false;
    await this.reviewRepo.save(review);
    return { id, isApproved: false };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    await this.reviewRepo.remove(review);
    return { success: true };
  }
}
