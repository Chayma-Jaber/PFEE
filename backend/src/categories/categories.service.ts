import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Category } from './entities/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    return this.categoryRepo.find({
      order: { position: 'ASC', name: 'ASC' },
    });
  }

  async findById(id: number): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { id },
      relations: ['parent', 'children'],
    });
    if (!category) {
      throw new NotFoundException(`Category with ID ${id} not found`);
    }
    return category;
  }

  async findBySlug(slug: string): Promise<Category> {
    const category = await this.categoryRepo.findOne({
      where: { slug },
      relations: ['parent', 'children'],
    });
    if (!category) {
      throw new NotFoundException(`Category with slug "${slug}" not found`);
    }
    return category;
  }

  /**
   * Build a nested category tree from root categories down.
   */
  async getTree(): Promise<Category[]> {
    const allCategories = await this.categoryRepo.find({
      order: { position: 'ASC', name: 'ASC' },
    });

    const categoryMap = new Map<number, Category & { children: Category[] }>();
    const roots: Array<Category & { children: Category[] }> = [];

    // First pass: index all categories
    for (const cat of allCategories) {
      categoryMap.set(cat.id, { ...cat, children: [] });
    }

    // Second pass: build tree
    for (const cat of allCategories) {
      const node = categoryMap.get(cat.id);
      if (cat.parentId && categoryMap.has(cat.parentId)) {
        categoryMap.get(cat.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async create(dto: CreateCategoryDto): Promise<Category> {
    if (dto.parentId) {
      const parentExists = await this.categoryRepo.findOne({
        where: { id: dto.parentId },
      });
      if (!parentExists) {
        throw new NotFoundException(`Parent category with ID ${dto.parentId} not found`);
      }
    }

    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.findById(id);

    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new Error('A category cannot be its own parent');
      }
      if (dto.parentId) {
        const parentExists = await this.categoryRepo.findOne({
          where: { id: dto.parentId },
        });
        if (!parentExists) {
          throw new NotFoundException(`Parent category with ID ${dto.parentId} not found`);
        }
      }
    }

    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async delete(id: number): Promise<void> {
    const category = await this.findById(id);

    // Re-parent children to this category's parent (or null)
    await this.categoryRepo.update(
      { parentId: id },
      { parentId: category.parentId ?? null },
    );

    await this.categoryRepo.remove(category);
  }
}
