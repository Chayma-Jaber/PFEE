import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Bundle } from './entities/bundle.entity';
import { BundleItem } from './entities/bundle-item.entity';
import { CreateBundleDto, UpdateBundleDto } from './dto/bundles.dto';

@Injectable()
export class BundlesService {
  constructor(
    @InjectRepository(Bundle)
    private readonly bundleRepo: Repository<Bundle>,
    @InjectRepository(BundleItem)
    private readonly bundleItemRepo: Repository<BundleItem>,
  ) {}

  async listBundles(
    limit: number = 20,
    offset: number = 0,
    activeOnly: boolean = true,
  ): Promise<{ bundles: Bundle[]; total: number }> {
    const where: any = {};
    if (activeOnly) {
      where.is_active = true;
    }

    const [bundles, total] = await this.bundleRepo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      take: limit,
      skip: offset,
      relations: ['items'],
    });

    return { bundles, total };
  }

  async getFeatured(limit: number = 6): Promise<Bundle[]> {
    const now = new Date();
    return this.bundleRepo.find({
      where: { is_active: true },
      order: { purchase_count: 'DESC', created_at: 'DESC' },
      take: limit,
      relations: ['items'],
    });
  }

  async getById(id: number): Promise<Bundle> {
    const bundle = await this.bundleRepo.findOne({
      where: { id },
      relations: ['items'],
    });
    if (!bundle) {
      throw new NotFoundException('Bundle not found');
    }
    return bundle;
  }

  async addToCart(
    bundleId: number,
    userId: number,
    selectedVariants?: Record<string, any>[],
  ): Promise<{ message: string; bundle: Bundle }> {
    const bundle = await this.getById(bundleId);

    if (!bundle.is_active) {
      throw new BadRequestException('Bundle is no longer active');
    }

    if (
      bundle.max_purchases &&
      bundle.purchase_count >= bundle.max_purchases
    ) {
      throw new BadRequestException('Bundle purchase limit reached');
    }

    const now = new Date();
    if (bundle.valid_from && new Date(bundle.valid_from) > now) {
      throw new BadRequestException('Bundle is not yet available');
    }
    if (bundle.valid_to && new Date(bundle.valid_to) < now) {
      throw new BadRequestException('Bundle has expired');
    }

    // Increment purchase count
    await this.bundleRepo.increment({ id: bundleId }, 'purchase_count', 1);

    return {
      message: 'Bundle added to cart successfully',
      bundle,
    };
  }

  async create(dto: CreateBundleDto): Promise<Bundle> {
    const { items: itemDtos, ...bundleData } = dto;

    const bundle = this.bundleRepo.create(bundleData);
    const saved = await this.bundleRepo.save(bundle);

    if (itemDtos && itemDtos.length > 0) {
      const items = itemDtos.map((itemDto, index) =>
        this.bundleItemRepo.create({
          bundle_id: saved.id,
          product_id: itemDto.product_id,
          quantity: itemDto.quantity ?? 1,
          position: itemDto.position ?? index,
        }),
      );
      await this.bundleItemRepo.save(items);
    }

    return this.getById(saved.id);
  }

  async update(id: number, dto: UpdateBundleDto): Promise<Bundle> {
    const bundle = await this.getById(id);
    const { items: itemDtos, ...bundleData } = dto;

    Object.assign(bundle, bundleData);
    await this.bundleRepo.save(bundle);

    if (itemDtos !== undefined) {
      // Remove existing items and replace
      await this.bundleItemRepo.delete({ bundle_id: id });
      if (itemDtos.length > 0) {
        const items = itemDtos.map((itemDto, index) =>
          this.bundleItemRepo.create({
            bundle_id: id,
            product_id: itemDto.product_id,
            quantity: itemDto.quantity ?? 1,
            position: itemDto.position ?? index,
          }),
        );
        await this.bundleItemRepo.save(items);
      }
    }

    return this.getById(id);
  }

  async delete(id: number): Promise<void> {
    const bundle = await this.getById(id);
    await this.bundleRepo.remove(bundle);
  }
}
