import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@ApiTags('Products')
@Controller()
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // ==================== Frontend API Endpoints ====================
  // These match the routes the Angular frontend expects

  @Get('getDeclinaisonStock/:id')
  @ApiOperation({ summary: 'Get variant stock info for a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async getDeclinaisonStock(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.getDeclinaisonStock(id);
  }

  @Post('checkStock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check stock availability for an EAN13 barcode' })
  async checkStock(@Body() body: { ean13: string; quantity: number }) {
    const result = await this.productsService.checkStock(body.ean13, body.quantity);
    return { inStock: result.inStock, availableStock: result.availableStock };
  }

  @Post('checkCartProducts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate stock for an array of cart items' })
  async checkCartProducts(@Body() items: Array<{ ean13: string; quantity: number }>) {
    return this.productsService.checkCartProducts(items);
  }

  @Post('checkCartOffers')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check available offers for cart items' })
  async checkCartOffers(
    @Body() items: Array<{ ean13: string; quantity: number; unitPrice: number }>,
  ) {
    return this.productsService.checkCartOffers(items);
  }

  // ==================== CRUD Endpoints ====================

  @Get('products')
  @ApiOperation({ summary: 'Get all products with optional filters' })
  @ApiQuery({ name: 'famille', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'isFeatured', required: false })
  @ApiQuery({ name: 'isBestseller', required: false })
  @ApiQuery({ name: 'isNew', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  async findAll(
    @Query('famille') famille?: string,
    @Query('isActive') isActive?: boolean,
    @Query('isFeatured') isFeatured?: boolean,
    @Query('isBestseller') isBestseller?: boolean,
    @Query('isNew') isNew?: boolean,
    @Query('brand') brand?: string,
    @Query('categoryId') categoryId?: number,
    @Query('category') categorySlug?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'ASC' | 'DESC',
  ) {
    return this.productsService.findAll({
      famille,
      isActive,
      isFeatured,
      isBestseller,
      isNew,
      brand,
      categoryId,
      categorySlug,
      limit,
      offset,
      sortBy,
      sortOrder,
    });
  }

  // Batched fetch — accepts repeated ?ids=1&ids=2&ids=3 OR a single ?ids=1,2,3 string.
  // Declared BEFORE the :id route so "by-ids" isn't parsed as an integer.
  @Get('products/by-ids')
  @ApiOperation({ summary: 'Get multiple products by id (batched)' })
  @ApiQuery({ name: 'ids', description: 'Repeated query param OR comma-separated list', required: true })
  async findByIds(@Query('ids') ids: string | string[]) {
    const flat: number[] = [];
    const consume = (v: any) => {
      if (v == null) return;
      if (Array.isArray(v)) { v.forEach(consume); return; }
      String(v).split(',').forEach((part) => {
        const n = Number(part.trim());
        if (Number.isInteger(n) && n > 0) flat.push(n);
      });
    };
    consume(ids);
    const items = await this.productsService.findByIds(flat);
    return { items, requested: flat.length, returned: items.length };
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async findById(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findById(id);
  }

  @Get('products/slug/:slug')
  @ApiOperation({ summary: 'Get a product by slug' })
  @ApiParam({ name: 'slug', description: 'Product slug' })
  async findBySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }

  @Get('products/sku/:sku')
  @ApiOperation({ summary: 'Get a product by SKU' })
  @ApiParam({ name: 'sku', description: 'Product SKU' })
  async findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  async create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async delete(@Param('id', ParseIntPipe) id: number) {
    await this.productsService.delete(id);
    return { message: 'Product deleted successfully' };
  }

  @Post('products/:id/view')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Increment product view count' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  async incrementViewCount(@Param('id', ParseIntPipe) id: number) {
    await this.productsService.incrementViewCount(id);
    return { message: 'View count incremented' };
  }

  @Get('products/:id/related')
  @ApiOperation({ summary: 'Get related products' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiQuery({ name: 'limit', required: false })
  async getRelatedProducts(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit') limit?: number,
  ) {
    return this.productsService.getRelatedProducts(id, limit);
  }
}
