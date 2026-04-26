import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
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

import { Bundle } from '../bundles/entities/bundle.entity';
import { BundleItem } from '../bundles/entities/bundle-item.entity';

@Controller('admin/bundles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminBundlesController {
  constructor(
    @InjectRepository(Bundle) private readonly bundleRepo: Repository<Bundle>,
    @InjectRepository(BundleItem) private readonly itemRepo: Repository<BundleItem>,
  ) {}

  @Get()
  async list() {
    const bundles = await this.bundleRepo.find({ order: { created_at: 'DESC' } });
    return {
      items: bundles.map((b) => ({
        id: b.id,
        name: b.name,
        description: b.description,
        imageUrl: b.image_url,
        bundlePrice: Number(b.bundle_price),
        originalPrice: Number(b.original_price),
        savingsAmount: Number(b.savings_amount),
        discountPercentage: Number(b.discount_percentage),
        isActive: b.is_active,
        validFrom: b.valid_from,
        validTo: b.valid_to,
        maxPurchases: b.max_purchases,
        purchaseCount: b.purchase_count,
        itemCount: b.items?.length || 0,
        items: b.items || [],
        createdAt: b.created_at,
      })),
    };
  }

  @Get(':id')
  async get(@Param('id', ParseIntPipe) id: number) {
    const b = await this.bundleRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bundle not found');
    return b;
  }

  @Post()
  async create(@Body() body: Record<string, any>) {
    const bundlePriceIn = body.bundlePrice ?? body.bundle_price;
    const originalPriceIn = body.originalPrice ?? body.original_price ?? bundlePriceIn;
    if (!body.name || !bundlePriceIn) {
      throw new BadRequestException('Nom et prix requis');
    }
    const bundlePrice = Number(bundlePriceIn);
    const originalPrice = Number(originalPriceIn);
    const savings = Math.max(0, originalPrice - bundlePrice);
    const discountPct = originalPrice > 0 ? Math.round((savings / originalPrice) * 100) : 0;

    const bundle = this.bundleRepo.create({
      name: body.name,
      description: body.description || null,
      image_url: body.imageUrl || null,
      bundle_price: bundlePrice,
      original_price: originalPrice,
      savings_amount: savings,
      discount_percentage: discountPct,
      is_active: body.isActive !== false,
      valid_from: body.validFrom ? new Date(body.validFrom) : null,
      valid_to: body.validTo ? new Date(body.validTo) : null,
      max_purchases: body.maxPurchases || null,
    });
    const saved = await this.bundleRepo.save(bundle);

    // Save items
    if (Array.isArray(body.items) && body.items.length > 0) {
      for (const it of body.items) {
        const item = this.itemRepo.create({
          bundle_id: saved.id,
          product_id: Number(it.productId),
          quantity: Number(it.quantity) || 1,
        } as any);
        await this.itemRepo.save(item);
      }
    }

    return this.bundleRepo.findOne({ where: { id: saved.id } });
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const b = await this.bundleRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bundle not found');

    if (body.name !== undefined) b.name = body.name;
    if (body.description !== undefined) b.description = body.description;
    if (body.imageUrl !== undefined) b.image_url = body.imageUrl;
    if (body.bundlePrice !== undefined) b.bundle_price = Number(body.bundlePrice);
    if (body.originalPrice !== undefined) b.original_price = Number(body.originalPrice);
    if (body.isActive !== undefined) b.is_active = !!body.isActive;
    if (body.validFrom !== undefined) b.valid_from = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validTo !== undefined) b.valid_to = body.validTo ? new Date(body.validTo) : null;
    if (body.maxPurchases !== undefined) b.max_purchases = body.maxPurchases;

    const savings = Math.max(0, Number(b.original_price) - Number(b.bundle_price));
    b.savings_amount = savings;
    b.discount_percentage = Number(b.original_price) > 0 ? Math.round((savings / Number(b.original_price)) * 100) : 0;

    return this.bundleRepo.save(b);
  }

  @Post(':id/toggle')
  async toggle(@Param('id', ParseIntPipe) id: number) {
    const b = await this.bundleRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bundle not found');
    b.is_active = !b.is_active;
    await this.bundleRepo.save(b);
    return { id, isActive: b.is_active };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const b = await this.bundleRepo.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Bundle not found');
    await this.bundleRepo.remove(b);
    return { success: true };
  }
}
