import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductReview } from './entities/product-review.entity';
import { ReviewVote } from './entities/review-vote.entity';
import { CreateReviewDto, ReviewQueryDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(ProductReview)
    private readonly reviewRepo: Repository<ProductReview>,
    @InjectRepository(ReviewVote)
    private readonly voteRepo: Repository<ReviewVote>,
  ) {}

  async getProductReviews(productId: number, query: ReviewQueryDto) {
    const { page = 1, limit = 10, sort = 'newest', rating, verifiedOnly } = query;

    const qb = this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.user', 'user')
      .where('review.product_id = :productId', { productId })
      .andWhere('review.is_approved = :approved', { approved: true });

    if (rating) {
      qb.andWhere('review.rating = :rating', { rating });
    }

    if (verifiedOnly) {
      qb.andWhere('review.is_verified_purchase = :verified', { verified: true });
    }

    switch (sort) {
      case 'oldest':
        qb.orderBy('review.created_at', 'ASC');
        break;
      case 'highest':
        qb.orderBy('review.rating', 'DESC');
        break;
      case 'lowest':
        qb.orderBy('review.rating', 'ASC');
        break;
      case 'most_helpful':
        qb.orderBy('review.helpful_count', 'DESC');
        break;
      case 'newest':
      default:
        qb.orderBy('review.created_at', 'DESC');
        break;
    }

    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [reviews, total] = await qb.getManyAndCount();

    return {
      reviews: reviews.map((r) => ({
        id: r.id,
        product_id: r.product_id,
        rating: r.rating,
        title: r.title,
        comment: r.comment,
        is_verified_purchase: r.is_verified_purchase,
        is_recommended: r.is_recommended,
        fit_rating: r.fit_rating,
        images: r.images,
        helpful_count: r.helpful_count,
        not_helpful_count: r.not_helpful_count,
        created_at: r.created_at,
        user: r.user
          ? {
              id: r.user.id,
              first_name: r.user.first_name,
              last_name: r.user.last_name,
              avatar_url: r.user.avatar_url,
            }
          : null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getProductReviewStats(productId: number) {
    const stats = await this.reviewRepo
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'averageRating')
      .addSelect('COUNT(review.id)', 'totalReviews')
      .where('review.product_id = :productId', { productId })
      .andWhere('review.is_approved = :approved', { approved: true })
      .getRawOne();

    const distribution = await this.reviewRepo
      .createQueryBuilder('review')
      .select('review.rating', 'rating')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.product_id = :productId', { productId })
      .andWhere('review.is_approved = :approved', { approved: true })
      .groupBy('review.rating')
      .getRawMany();

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const row of distribution) {
      dist[row.rating] = parseInt(row.count, 10);
    }

    return {
      averageRating: stats.averageRating ? parseFloat(parseFloat(stats.averageRating).toFixed(2)) : 0,
      totalReviews: parseInt(stats.totalReviews, 10),
      distribution: dist,
    };
  }

  async canUserReview(userId: number, productId: number) {
    const existing = await this.reviewRepo.findOne({
      where: { user_id: userId, product_id: productId },
    });

    return {
      canReview: !existing,
      existingReviewId: existing ? existing.id : null,
    };
  }

  async createReview(userId: number, dto: CreateReviewDto) {
    const existing = await this.reviewRepo.findOne({
      where: { user_id: userId, product_id: dto.productId },
    });

    if (existing) {
      throw new ConflictException('You have already reviewed this product');
    }

    const review = this.reviewRepo.create({
      product_id: dto.productId,
      user_id: userId,
      rating: dto.rating,
      title: dto.title,
      comment: dto.comment,
      images: dto.images || null,
      is_recommended: dto.isRecommended ?? null,
      fit_rating: dto.fitRating || null,
    });

    const saved = await this.reviewRepo.save(review);
    return saved;
  }

  async voteReview(reviewId: number, userId: number, isHelpful: boolean) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.user_id === userId) {
      throw new BadRequestException('You cannot vote on your own review');
    }

    const existingVote = await this.voteRepo.findOne({
      where: { review_id: reviewId, user_id: userId },
    });

    if (existingVote) {
      // Update existing vote
      const previousHelpful = existingVote.is_helpful;
      existingVote.is_helpful = isHelpful;
      await this.voteRepo.save(existingVote);

      // Adjust counts
      if (previousHelpful !== isHelpful) {
        if (isHelpful) {
          review.helpful_count += 1;
          review.not_helpful_count = Math.max(0, review.not_helpful_count - 1);
        } else {
          review.not_helpful_count += 1;
          review.helpful_count = Math.max(0, review.helpful_count - 1);
        }
        await this.reviewRepo.save(review);
      }
    } else {
      // Create new vote
      const vote = this.voteRepo.create({
        review_id: reviewId,
        user_id: userId,
        is_helpful: isHelpful,
      });
      await this.voteRepo.save(vote);

      if (isHelpful) {
        review.helpful_count += 1;
      } else {
        review.not_helpful_count += 1;
      }
      await this.reviewRepo.save(review);
    }

    return {
      helpful_count: review.helpful_count,
      not_helpful_count: review.not_helpful_count,
    };
  }

  async getUserReviews(userId: number, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [reviews, total] = await this.reviewRepo.findAndCount({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
      skip,
      take: limit,
    });

    return {
      reviews,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteReview(reviewId: number, userId: number) {
    const review = await this.reviewRepo.findOne({ where: { id: reviewId } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.user_id !== userId) {
      throw new ForbiddenException('You can only delete your own reviews');
    }

    await this.reviewRepo.remove(review);
    return { message: 'Review deleted successfully' };
  }
}
