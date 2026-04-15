import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Product } from './entities/product.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { ProductImage } from './entities/product-image.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Category } from '../categories/entities/category.entity';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantRepo: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly imageRepo: Repository<ProductImage>,
    @InjectRepository(Category)
    private readonly categoryRepo: Repository<Category>,
  ) {}

  async findAll(filters?: {
    famille?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    isBestseller?: boolean;
    isNew?: boolean;
    brand?: string;
    categoryId?: number;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ items: Product[]; total: number }> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category');

    if (filters?.famille) {
      qb.andWhere('product.famille = :famille', { famille: filters.famille });
    }
    if (filters?.isActive !== undefined) {
      qb.andWhere('product.is_active = :isActive', { isActive: filters.isActive });
    }
    if (filters?.isFeatured !== undefined) {
      qb.andWhere('product.is_featured = :isFeatured', { isFeatured: filters.isFeatured });
    }
    if (filters?.isBestseller !== undefined) {
      qb.andWhere('product.is_bestseller = :isBestseller', { isBestseller: filters.isBestseller });
    }
    if (filters?.isNew !== undefined) {
      qb.andWhere('product.is_new = :isNew', { isNew: filters.isNew });
    }
    if (filters?.brand) {
      qb.andWhere('product.brand = :brand', { brand: filters.brand });
    }
    if (filters?.categoryId) {
      qb.andWhere('category.id = :categoryId', { categoryId: filters.categoryId });
    }

    const sortBy = filters?.sortBy || 'created_at';
    const sortOrder = filters?.sortOrder || 'DESC';
    qb.orderBy(`product.${sortBy}`, sortOrder);

    const total = await qb.getCount();

    if (filters?.limit) {
      qb.take(filters.limit);
    }
    if (filters?.offset) {
      qb.skip(filters.offset);
    }

    const items = await qb.getMany();
    return { items, total };
  }

  async findById(id: number): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['categories', 'variants', 'images'],
    });
    if (!product) {
      throw new NotFoundException(`Product with ID ${id} not found`);
    }
    return product;
  }

  async findBySlug(slug: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { slug },
      relations: ['categories', 'variants', 'images'],
    });
    if (!product) {
      throw new NotFoundException(`Product with slug "${slug}" not found`);
    }
    return product;
  }

  async findBySku(sku: string): Promise<Product> {
    const product = await this.productRepo.findOne({
      where: { sku },
      relations: ['categories', 'variants', 'images'],
    });
    if (!product) {
      throw new NotFoundException(`Product with SKU "${sku}" not found`);
    }
    return product;
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const product = this.productRepo.create({
      ...dto,
      currentPrice: dto.currentPrice ?? dto.price,
    });

    if (dto.categoryIds?.length) {
      product.categories = await this.categoryRepo.findBy({
        id: In(dto.categoryIds),
      });
    }

    return this.productRepo.save(product);
  }

  async update(id: number, dto: UpdateProductDto): Promise<Product> {
    const product = await this.findById(id);

    // Handle category IDs separately
    const { categoryIds, ...updateData } = dto;
    Object.assign(product, updateData);

    if (categoryIds !== undefined) {
      product.categories = categoryIds.length
        ? await this.categoryRepo.findBy({ id: In(categoryIds) })
        : [];
    }

    return this.productRepo.save(product);
  }

  async delete(id: number): Promise<void> {
    const product = await this.findById(id);
    await this.productRepo.remove(product);
  }

  /**
   * Check stock availability for a given EAN13 barcode and quantity.
   * Returns { inStock: boolean, availableStock: number }
   */
  async checkStock(
    ean13: string,
    quantity: number,
  ): Promise<{ inStock: boolean; availableStock: number }> {
    const variant = await this.variantRepo.findOne({ where: { ean13 } });

    if (!variant) {
      this.logger.warn(`Variant with EAN13 "${ean13}" not found`);
      return { inStock: false, availableStock: 0 };
    }

    return {
      inStock: variant.stock >= quantity,
      availableStock: variant.stock,
    };
  }

  /**
   * Get variant (declinaison) stock info for a product.
   * Returns all variants with their stock, color, size, ean13.
   */
  async getDeclinaisonStock(productId: number): Promise<ProductVariant[]> {
    return this.variantRepo.find({
      where: { productId },
      order: { position: 'ASC' },
    });
  }

  /**
   * Increment the view count for a product.
   */
  async incrementViewCount(id: number): Promise<void> {
    await this.productRepo.increment({ id }, 'viewCount', 1);
  }

  /**
   * Get related products based on the same categories, famille, and persona.
   */
  async getRelatedProducts(productId: number, limit = 8): Promise<Product[]> {
    const product = await this.productRepo.findOne({
      where: { id: productId },
      relations: ['categories'],
    });

    if (!product) {
      return [];
    }

    const categoryIds = product.categories?.map((c) => c.id) || [];

    const qb = this.productRepo
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.categories', 'category')
      .where('product.id != :productId', { productId })
      .andWhere('product.is_active = :isActive', { isActive: true });

    if (categoryIds.length > 0) {
      qb.andWhere('category.id IN (:...categoryIds)', { categoryIds });
    }

    if (product.famille) {
      qb.andWhere('product.famille = :famille', { famille: product.famille });
    }

    qb.orderBy('product.order_count', 'DESC').take(limit);

    return qb.getMany();
  }

  /**
   * Validate an array of cart items by checking stock for each.
   * Returns items with their stock status.
   */
  async checkCartProducts(
    items: Array<{ ean13: string; quantity: number }>,
  ): Promise<Array<{ ean13: string; quantity: number; inStock: boolean; availableStock: number }>> {
    const results = [];

    for (const item of items) {
      const stockInfo = await this.checkStock(item.ean13, item.quantity);
      results.push({
        ean13: item.ean13,
        quantity: item.quantity,
        inStock: stockInfo.inStock,
        availableStock: stockInfo.availableStock,
      });
    }

    return results;
  }

  /**
   * Check cart items for any applicable offers / promotions.
   * Items come as { ean13, quantity, unitPrice }.
   * Returns items enriched with offer info (discount details if any).
   */
  async checkCartOffers(
    items: Array<{ ean13: string; quantity: number; unitPrice: number }>,
  ): Promise<
    Array<{
      ean13: string;
      quantity: number;
      unitPrice: number;
      finalPrice: number;
      discount: number;
      hasOffer: boolean;
      offerLabel?: string;
    }>
  > {
    const results = [];

    for (const item of items) {
      const variant = await this.variantRepo.findOne({
        where: { ean13: item.ean13 },
        relations: ['product'],
      });

      let discount = 0;
      let finalPrice = item.unitPrice;
      let hasOffer = false;
      let offerLabel: string | undefined;

      if (variant?.product) {
        const product = variant.product;
        if (product.discount > 0) {
          discount = product.discount;
          finalPrice = item.unitPrice * (1 - discount / 100);
          hasOffer = true;
          offerLabel = `-${discount}%`;
        }
        // If the product has a different current_price, use it
        if (product.currentPrice && product.currentPrice < item.unitPrice) {
          finalPrice = product.currentPrice;
          hasOffer = true;
          discount = Math.round(
            ((item.unitPrice - product.currentPrice) / item.unitPrice) * 100,
          );
          offerLabel = `-${discount}%`;
        }
      }

      results.push({
        ean13: item.ean13,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        finalPrice: Math.round(finalPrice * 1000) / 1000,
        discount,
        hasOffer,
        offerLabel,
      });
    }

    return results;
  }
}
