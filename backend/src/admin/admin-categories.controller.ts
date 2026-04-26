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

import { Category } from '../categories/entities/category.entity';

@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminCategoriesController {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  private slugify(input: string): string {
    return input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  @Get()
  async list() {
    const rows = await this.categoryRepo
      .createQueryBuilder('c')
      .leftJoin('c.products', 'p')
      .select('c.id', 'id')
      .addSelect('c.name', 'name')
      .addSelect('c.slug', 'slug')
      .addSelect('c.description', 'description')
      .addSelect('c.parent_id', 'parentId')
      .addSelect('c.image_url', 'imageUrl')
      .addSelect('c.banner_url', 'bannerUrl')
      .addSelect('c.position', 'position')
      .addSelect('c.is_active', 'isActive')
      .addSelect('c.is_featured', 'isFeatured')
      .addSelect('c.meta_title', 'metaTitle')
      .addSelect('c.meta_description', 'metaDescription')
      .addSelect('c.keywords', 'keywords')
      .addSelect('COUNT(p.id)', 'productCount')
      .groupBy('c.id')
      .addGroupBy('c.name')
      .addGroupBy('c.slug')
      .addGroupBy('c.description')
      .addGroupBy('c.parent_id')
      .addGroupBy('c.image_url')
      .addGroupBy('c.banner_url')
      .addGroupBy('c.position')
      .addGroupBy('c.is_active')
      .addGroupBy('c.is_featured')
      .addGroupBy('c.meta_title')
      .addGroupBy('c.meta_description')
      .addGroupBy('c.keywords')
      .orderBy('c.position', 'ASC')
      .addOrderBy('c.name', 'ASC')
      .getRawMany();

    const categories = rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      slug: r.slug,
      description: r.description,
      parentId: r.parentId != null ? Number(r.parentId) : null,
      imageUrl: r.imageUrl,
      bannerUrl: r.bannerUrl,
      position: Number(r.position) || 0,
      isActive: r.isActive === true || r.isActive === 1,
      isFeatured: r.isFeatured === true || r.isFeatured === 1,
      metaTitle: r.metaTitle,
      metaDescription: r.metaDescription,
      keywords: r.keywords,
      productCount: Number(r.productCount) || 0,
    }));

    // Attach parent name for display
    const byId = new Map<number, string>();
    for (const c of categories) byId.set(c.id, c.name);
    const enriched = categories.map((c) => ({
      ...c,
      parentName: c.parentId ? byId.get(c.parentId) || null : null,
    }));

    return { categories: enriched };
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  @Post()
  async create(@Body() body: any) {
    if (!body.name || !String(body.name).trim()) {
      throw new BadRequestException('Le nom est requis');
    }

    const slug = (body.slug && String(body.slug).trim()) || this.slugify(body.name);

    // Ensure unique slug
    const existing = await this.categoryRepo.findOne({ where: { slug } });
    if (existing) {
      throw new BadRequestException(`Le slug "${slug}" est déjà utilisé`);
    }

    if (body.parentId) {
      const parent = await this.categoryRepo.findOne({ where: { id: body.parentId } });
      if (!parent) throw new BadRequestException('Catégorie parente introuvable');
    }

    const cat = this.categoryRepo.create({
      name: body.name,
      slug,
      description: body.description || null,
      parentId: body.parentId || null,
      imageUrl: body.imageUrl || null,
      bannerUrl: body.bannerUrl || null,
      position: body.position != null ? Number(body.position) : 0,
      isActive: body.isActive !== undefined ? !!body.isActive : true,
      isFeatured: body.isFeatured !== undefined ? !!body.isFeatured : false,
      metaTitle: body.metaTitle || null,
      metaDescription: body.metaDescription || null,
      keywords: body.keywords || null,
    });

    return this.categoryRepo.save(cat);
  }

  @Put(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() body: any) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');

    if (body.parentId && Number(body.parentId) === id) {
      throw new BadRequestException('Une catégorie ne peut pas être son propre parent');
    }

    if (body.parentId && Number(body.parentId) !== cat.parentId) {
      const parent = await this.categoryRepo.findOne({ where: { id: Number(body.parentId) } });
      if (!parent) throw new BadRequestException('Catégorie parente introuvable');
    }

    if (body.slug && body.slug !== cat.slug) {
      const dup = await this.categoryRepo.findOne({ where: { slug: body.slug } });
      if (dup && dup.id !== id) {
        throw new BadRequestException(`Le slug "${body.slug}" est déjà utilisé`);
      }
    }

    // Auto-regenerate slug if name changed and no slug override
    if (body.name && body.name !== cat.name && !body.slug) {
      const newSlug = this.slugify(body.name);
      const dup = await this.categoryRepo.findOne({ where: { slug: newSlug } });
      if (!dup || dup.id === id) {
        cat.slug = newSlug;
      }
    }

    if (body.name !== undefined) cat.name = body.name;
    if (body.slug !== undefined) cat.slug = body.slug;
    if (body.description !== undefined) cat.description = body.description;
    if (body.parentId !== undefined) cat.parentId = body.parentId || null;
    if (body.imageUrl !== undefined) cat.imageUrl = body.imageUrl;
    if (body.bannerUrl !== undefined) cat.bannerUrl = body.bannerUrl;
    if (body.position !== undefined) cat.position = Number(body.position) || 0;
    if (body.isActive !== undefined) cat.isActive = !!body.isActive;
    if (body.isFeatured !== undefined) cat.isFeatured = !!body.isFeatured;
    if (body.metaTitle !== undefined) cat.metaTitle = body.metaTitle;
    if (body.metaDescription !== undefined) cat.metaDescription = body.metaDescription;
    if (body.keywords !== undefined) cat.keywords = body.keywords;

    return this.categoryRepo.save(cat);
  }

  @Post(':id/toggle')
  async toggle(@Param('id', ParseIntPipe) id: number) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');
    cat.isActive = !cat.isActive;
    await this.categoryRepo.save(cat);
    return { id, isActive: cat.isActive };
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const cat = await this.categoryRepo.findOne({ where: { id } });
    if (!cat) throw new NotFoundException('Category not found');

    // Re-parent children
    await this.categoryRepo.update(
      { parentId: id },
      { parentId: cat.parentId ?? null },
    );

    await this.categoryRepo.remove(cat);
    return { success: true };
  }
}
