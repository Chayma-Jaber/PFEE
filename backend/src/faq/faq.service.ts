import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FAQ } from './entities/faq.entity';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(FAQ)
    private readonly faqRepo: Repository<FAQ>,
  ) {}

  async getCategories(): Promise<{ slug: string; name: string; count: number }[]> {
    const results = await this.faqRepo
      .createQueryBuilder('faq')
      .select('faq.category_slug', 'slug')
      .addSelect('faq.category_name', 'name')
      .addSelect('COUNT(faq.id)', 'count')
      .where('faq.is_active = :active', { active: true })
      .groupBy('faq.category_slug')
      .addGroupBy('faq.category_name')
      .orderBy('faq.category_name', 'ASC')
      .getRawMany();

    return results.map((r) => ({
      slug: r.slug,
      name: r.name,
      count: Number(r.count),
    }));
  }

  async getFaqsByCategory(slug: string): Promise<FAQ[]> {
    return this.faqRepo.find({
      where: { category_slug: slug, is_active: true },
      order: { position: 'ASC' },
    });
  }

  async getFeatured(limit: number = 5): Promise<FAQ[]> {
    return this.faqRepo.find({
      where: { is_featured: true, is_active: true },
      order: { position: 'ASC' },
      take: limit,
    });
  }

  async search(query: string): Promise<FAQ[]> {
    return this.faqRepo
      .createQueryBuilder('faq')
      .where('faq.is_active = :active', { active: true })
      .andWhere(
        '(LOWER(faq.question) LIKE :q OR LOWER(faq.answer) LIKE :q)',
        { q: `%${query.toLowerCase()}%` },
      )
      .orderBy('faq.position', 'ASC')
      .getMany();
  }

  async findById(id: number): Promise<FAQ> {
    const faq = await this.faqRepo.findOne({
      where: { id, is_active: true },
    });

    if (!faq) {
      throw new NotFoundException(`FAQ #${id} not found`);
    }

    return faq;
  }
}
