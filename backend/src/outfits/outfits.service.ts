import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outfit } from './entities/outfit.entity';
import { CreateOutfitDto, UpdateOutfitDto } from './dto/outfits.dto';

@Injectable()
export class OutfitsService {
  constructor(
    @InjectRepository(Outfit)
    private readonly outfitRepo: Repository<Outfit>,
  ) {}

  async listPublished(): Promise<Outfit[]> {
    return this.outfitRepo.find({
      where: { is_published: true },
      order: { created_at: 'DESC' },
    });
  }

  async getFeatured(limit: number = 6): Promise<Outfit[]> {
    return this.outfitRepo.find({
      where: { is_published: true },
      order: { view_count: 'DESC', created_at: 'DESC' },
      take: limit,
    });
  }

  async getById(id: number): Promise<Outfit> {
    const outfit = await this.outfitRepo.findOne({ where: { id } });
    if (!outfit) {
      throw new NotFoundException('Outfit not found');
    }
    // Increment view count
    await this.outfitRepo.increment({ id }, 'view_count', 1);
    outfit.view_count += 1;
    return outfit;
  }

  async getByOccasion(occasion: string): Promise<Outfit[]> {
    return this.outfitRepo.find({
      where: { occasion, is_published: true },
      order: { created_at: 'DESC' },
    });
  }

  async getByProduct(productId: number, limit?: number): Promise<Outfit[]> {
    const outfits = await this.outfitRepo.find({
      where: { is_published: true },
      order: { created_at: 'DESC' },
    });
    const matching = outfits.filter(
      (o) => Array.isArray(o.products) && o.products.includes(productId),
    );
    return limit ? matching.slice(0, limit) : matching;
  }

  async create(dto: CreateOutfitDto, createdBy: number): Promise<Outfit> {
    const outfit = this.outfitRepo.create({
      ...dto,
      created_by: createdBy,
    });
    return this.outfitRepo.save(outfit);
  }

  async update(id: number, dto: UpdateOutfitDto): Promise<Outfit> {
    const outfit = await this.outfitRepo.findOne({ where: { id } });
    if (!outfit) {
      throw new NotFoundException('Outfit not found');
    }
    Object.assign(outfit, dto);
    return this.outfitRepo.save(outfit);
  }

  async delete(id: number): Promise<void> {
    const outfit = await this.outfitRepo.findOne({ where: { id } });
    if (!outfit) {
      throw new NotFoundException('Outfit not found');
    }
    await this.outfitRepo.remove(outfit);
  }
}
