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

  private normalizeVariantKey(value?: string | null): string {
    return (value || '')
      .toString()
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '');
  }

  async findAll(filters?: {
    famille?: string;
    isActive?: boolean;
    isFeatured?: boolean;
    isBestseller?: boolean;
    isNew?: boolean;
    brand?: string;
    categoryId?: number;
    categorySlug?: string;
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
    if (filters?.categorySlug) {
      qb.andWhere('category.slug = :categorySlug', { categorySlug: filters.categorySlug });
    }

    // Map UI sort keys to entity property names (TypeORM uses entity props, not DB columns)
    const sortKeyMap: Record<string, string> = {
      'created_at': 'createdAt',
      'createdAt': 'createdAt',
      'price': 'price',
      'current_price': 'currentPrice',
      'currentPrice': 'currentPrice',
      'title': 'title',
      'view_count': 'viewCount',
      'viewCount': 'viewCount',
      'order_count': 'orderCount',
      'orderCount': 'orderCount',
      'total_stock': 'totalStock',
      'totalStock': 'totalStock',
    };
    const rawSort = filters?.sortBy || 'createdAt';
    const sortBy = sortKeyMap[rawSort] || 'createdAt';
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

  // Batched fetch — returns ONLY products that exist; missing ids are silently dropped.
  // Caller can compare returned length vs requested length to detect missing items.
  // Hard cap = 100 ids per call to keep query plans bounded.
  async findByIds(ids: number[]): Promise<Product[]> {
    const safeIds = (ids || []).map((x) => Number(x)).filter((x) => Number.isInteger(x) && x > 0).slice(0, 100);
    if (safeIds.length === 0) return [];
    return this.productRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids)', { ids: safeIds })
      .andWhere('p.is_active = :a', { a: true })
      .getMany();
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
    fallback?: { productId?: number; color?: string; size?: string },
  ): Promise<{
    inStock: boolean;
    availableStock: number;
    ean13?: string | null;
    productId?: number;
    color?: string | null;
    size?: string | null;
  }> {
    let variant = ean13
      ? await this.variantRepo.findOne({ where: { ean13 } })
      : null;

    if (!variant && fallback?.productId) {
      const variants = await this.variantRepo.find({
        where: { productId: fallback.productId },
        order: { position: 'ASC' },
      });
      const targetSize = this.normalizeVariantKey(fallback.size);
      const targetColor = this.normalizeVariantKey(fallback.color);

      variant =
        variants.find(
          (item) =>
            this.normalizeVariantKey(item.taille) === targetSize &&
            this.normalizeVariantKey(item.couleur) === targetColor,
        ) ||
        variants.find((item) => this.normalizeVariantKey(item.taille) === targetSize) ||
        variants.find((item) => this.normalizeVariantKey(item.couleur) === targetColor) ||
        variants[0] ||
        null;
    }

    if (!variant) {
      this.logger.warn(`Variant with EAN13 "${ean13}" not found`);
      return { inStock: false, availableStock: 0 };
    }

    return {
      inStock: variant.stock >= quantity,
      availableStock: variant.stock,
      ean13: variant.ean13,
      productId: variant.productId,
      color: variant.couleur,
      size: variant.taille,
    };
  }

  /**
   * Get variant (declinaison) stock info for a product.
   * Returns all variants with their stock, color, size, ean13.
   */
  async getDeclinaisonStock(productIdOrVariantId: number): Promise<ProductVariant[]> {
    const directVariants = await this.variantRepo.find({
      where: { productId: productIdOrVariantId },
      order: { position: 'ASC' },
    });

    if (directVariants.length > 0) {
      return directVariants;
    }

    const productByExternalId = await this.productRepo.findOne({
      where: { externalId: String(productIdOrVariantId) },
    });

    if (productByExternalId) {
      return this.variantRepo.find({
        where: { productId: productByExternalId.id },
        order: { position: 'ASC' },
      });
    }

    const matchedVariant = await this.variantRepo.findOne({
      where: { id: productIdOrVariantId },
    });

    if (!matchedVariant) {
      return [];
    }

    return this.variantRepo.find({
      where: { productId: matchedVariant.productId },
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
