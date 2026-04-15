import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { FAQ } from '../faq/entities/faq.entity';

@Controller('admin/faq')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminFaqController {
  constructor(
    @InjectRepository(FAQ)
    private readonly faqRepo: Repository<FAQ>,
  ) {}

  // ─── Categories ─────────────────────────────────────────────────────

  @Get('categories')
  async getCategories() {
    const raw = await this.faqRepo
      .createQueryBuilder('f')
      .select('f.category_slug', 'slug')
      .addSelect('f.category_name', 'name')
      .addSelect('COUNT(f.id)', 'faq_count')
      .addSelect('MIN(CAST(f.is_active AS int))', 'is_active')
      .groupBy('f.category_slug')
      .addGroupBy('f.category_name')
      .getRawMany();

    const categories = raw.map((r, idx) => ({
      id: idx + 1,
      slug: r.slug,
      name: r.name,
      faq_count: parseInt(r.faq_count, 10),
      is_active: r.is_active === 1 || r.is_active === true,
    }));
    return { categories };
  }

  @Post('categories')
  async createCategory(
    @Body() body: { name: string; slug?: string },
  ) {
    const slug = body.slug || body.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    // Create a placeholder FAQ for this category so it appears in the categories list
    const faq = this.faqRepo.create({
      category_slug: slug,
      category_name: body.name,
      question: '',
      answer: '',
      is_active: true,
      position: 0,
    });
    await this.faqRepo.save(faq);
    return { slug, name: body.name, is_active: true, faq_count: 0 };
  }

  @Put('categories/:id')
  async updateCategory(
    @Param('id') id: string,
    @Body() body: { name?: string; slug?: string },
  ) {
    // id could be numeric index or slug; we search by slug
    const categories = await this.getDistinctCategories();
    const cat = categories[parseInt(id, 10) - 1];
    if (!cat) throw new NotFoundException('Category not found');

    const updateData: any = {};
    if (body.name) updateData.category_name = body.name;
    if (body.slug) updateData.category_slug = body.slug;

    if (Object.keys(updateData).length > 0) {
      await this.faqRepo
        .createQueryBuilder()
        .update(FAQ)
        .set(updateData)
        .where('category_slug = :slug', { slug: cat.slug })
        .execute();
    }

    return { success: true };
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    const categories = await this.getDistinctCategories();
    const cat = categories[parseInt(id, 10) - 1];
    if (!cat) throw new NotFoundException('Category not found');

    await this.faqRepo
      .createQueryBuilder()
      .delete()
      .from(FAQ)
      .where('category_slug = :slug', { slug: cat.slug })
      .execute();

    return { success: true };
  }

  @Post('categories/:id/toggle')
  async toggleCategory(@Param('id') id: string) {
    const categories = await this.getDistinctCategories();
    const cat = categories[parseInt(id, 10) - 1];
    if (!cat) throw new NotFoundException('Category not found');

    // Toggle all FAQs in this category
    await this.faqRepo
      .createQueryBuilder()
      .update(FAQ)
      .set({ is_active: () => 'CASE WHEN is_active = 1 THEN 0 ELSE 1 END' })
      .where('category_slug = :slug', { slug: cat.slug })
      .execute();

    return { success: true };
  }

  // ─── FAQs ───────────────────────────────────────────────────────────

  @Get('faqs')
  async getFaqs(@Query('category_id') categoryId?: string) {
    const qb = this.faqRepo.createQueryBuilder('f').orderBy('f.position', 'ASC');

    if (categoryId) {
      // category_id could be numeric index; map to slug
      const categories = await this.getDistinctCategories();
      const cat = categories[parseInt(categoryId, 10) - 1];
      if (cat) {
        qb.where('f.category_slug = :slug', { slug: cat.slug });
      }
    }

    // Filter out placeholder FAQs (empty question)
    qb.andWhere("LEN(CAST(f.question AS nvarchar(MAX))) > 0");

    const faqs = await qb.getMany();
    return { faqs };
  }

  @Post('faqs')
  async createFaq(
    @Body()
    body: {
      question: string;
      answer: string;
      category_slug?: string;
      category_name?: string;
      position?: number;
      is_active?: boolean;
      is_featured?: boolean;
    },
  ) {
    const faq = this.faqRepo.create({
      question: body.question,
      answer: body.answer,
      category_slug: body.category_slug || 'general',
      category_name: body.category_name || 'General',
      position: body.position || 0,
      is_active: body.is_active !== undefined ? body.is_active : true,
      is_featured: body.is_featured || false,
    });
    return this.faqRepo.save(faq);
  }

  @Put('faqs/:id')
  async updateFaq(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: Partial<FAQ>,
  ) {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');

    Object.assign(faq, body);
    return this.faqRepo.save(faq);
  }

  @Delete('faqs/:id')
  async deleteFaq(@Param('id', ParseIntPipe) id: number) {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');

    await this.faqRepo.remove(faq);
    return { success: true };
  }

  @Post('faqs/:id/toggle')
  async toggleFaq(@Param('id', ParseIntPipe) id: number) {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');

    faq.is_active = !faq.is_active;
    return this.faqRepo.save(faq);
  }

  @Post('faqs/:id/feature')
  async featureFaq(@Param('id', ParseIntPipe) id: number) {
    const faq = await this.faqRepo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');

    faq.is_featured = !faq.is_featured;
    return this.faqRepo.save(faq);
  }

  // ─── Helpers ────────────────────────────────────────────────────────

  private async getDistinctCategories() {
    const raw = await this.faqRepo
      .createQueryBuilder('f')
      .select('f.category_slug', 'slug')
      .addSelect('f.category_name', 'name')
      .groupBy('f.category_slug')
      .addGroupBy('f.category_name')
      .getRawMany();
    return raw;
  }
}
