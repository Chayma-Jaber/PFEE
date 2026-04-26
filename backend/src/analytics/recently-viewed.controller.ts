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
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';

import { RecentlyViewed } from './entities/recently-viewed.entity';
import { Product } from '../products/entities/product.entity';

@Controller('recently-viewed')
@SkipTransform()
export class RecentlyViewedController {
  constructor(
    @InjectRepository(RecentlyViewed)
    private readonly rvRepo: Repository<RecentlyViewed>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}

  /** Track a product view. Only logged-in users are persisted. */
  @Post('track')
  @UseGuards(JwtAuthGuard)
  async track(
    @CurrentUser('id') userId: number,
    @Body() body: { productId: number },
  ) {
    if (!userId || !body?.productId) return { tracked: false };
    const pid = Number(body.productId);

    const existing = await this.rvRepo.findOne({
      where: { user_id: userId, product_id: pid },
    });
    if (existing) {
      existing.view_count = (existing.view_count || 0) + 1;
      // last_viewed_at bumps automatically via @UpdateDateColumn
      await this.rvRepo.save(existing);
    } else {
      const entry = this.rvRepo.create({
        user_id: userId,
        product_id: pid,
        view_count: 1,
      });
      await this.rvRepo.save(entry);
    }
    return { tracked: true, productId: pid };
  }

  /** Get the current user's recently viewed products (most recent first). */
  @Get()
  @UseGuards(JwtAuthGuard)
  async list(
    @CurrentUser('id') userId: number,
    @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit: number,
  ) {
    const rows = await this.rvRepo.find({
      where: { user_id: userId },
      order: { last_viewed_at: 'DESC' },
      take: limit,
    });
    if (rows.length === 0) return { items: [] };

    const productIds = rows.map((r) => r.product_id);
    const products = await this.productRepo.find({ where: { id: In(productIds) } });
    const byId = new Map<number, Product>();
    products.forEach((p) => byId.set(p.id, p));

    const items = rows
      .map((r) => {
        const p = byId.get(r.product_id);
        if (!p) return null;
        return {
          id: p.id,
          sku: p.sku,
          title: p.title,
          slug: p.slug,
          price: Number(p.price),
          currentPrice: Number(p.currentPrice),
          firstImageUrl: p.firstImageUrl,
          secondImageUrl: p.secondImageUrl,
          lastViewedAt: r.last_viewed_at,
          viewCount: r.view_count,
        };
      })
      .filter(Boolean);

    return { items };
  }

  @Delete(':productId')
  @UseGuards(JwtAuthGuard)
  async remove(
    @CurrentUser('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number,
  ) {
    await this.rvRepo.delete({ user_id: userId, product_id: productId });
    return { success: true };
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async clear(@CurrentUser('id') userId: number) {
    await this.rvRepo.delete({ user_id: userId });
    return { success: true };
  }
}
