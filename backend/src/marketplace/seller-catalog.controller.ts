import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { SellerCatalogService } from './seller-catalog.service';

@Controller('storefront/seller/catalog')
@UseGuards(JwtAuthGuard)
@SkipTransform()
export class SellerCatalogController {
  constructor(private readonly svc: SellerCatalogService) {}

  // ─── Stats ────────────────────────────────────────────────
  @Get('stats')
  stats(@CurrentUser('id') userId: number): any { return this.svc.stats(userId); }

  @Get('orders/stats')
  ordersStats(@CurrentUser('id') userId: number): any { return this.svc.ordersStats(userId); }

  // ─── Products ─────────────────────────────────────────────
  @Get('products')
  async list(@CurrentUser('id') userId: number): Promise<any> {
    return { items: await this.svc.listMyProducts(userId) };
  }

  @Post('products')
  create(@CurrentUser('id') userId: number, @Body() body: any): any {
    return this.svc.createProduct(userId, body);
  }

  @Get('products/:id')
  one(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.getMyProduct(userId, id);
  }

  @Put('products/:id')
  update(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number, @Body() body: any): any {
    return this.svc.updateProduct(userId, id, body);
  }

  @Delete('products/:id')
  remove(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): any {
    return this.svc.deleteProduct(userId, id);
  }

  // ─── Orders that contain this seller's products ──────────
  @Get('orders')
  async orders(
    @CurrentUser('id') userId: number,
    @Query('status') status?: string,
    @Query('limit', new DefaultValuePipe(100), ParseIntPipe) limit = 100,
  ): Promise<any> {
    return { items: await this.svc.listMyOrders(userId, { status, limit }) };
  }

  // ─── Image gallery ────────────────────────────────────────
  @Get('products/:id/images')
  async images(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): Promise<any> {
    return { items: await this.svc.listImages(userId, id) };
  }

  @Post('products/:id/images')
  addImage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { imageUrl: string; altText?: string },
  ): any {
    return this.svc.addImage(userId, id, body?.imageUrl, body?.altText);
  }

  @Delete('products/:id/images/:imageId')
  removeImage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('imageId', ParseIntPipe) imageId: number,
  ): any {
    return this.svc.removeImage(userId, id, imageId);
  }

  @Post('products/:id/images/reorder')
  reorderImages(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { orderedIds: number[] },
  ): any {
    return this.svc.reorderImages(userId, id, body?.orderedIds || []);
  }

  // ─── Variants ─────────────────────────────────────────────
  @Get('products/:id/variants')
  async variants(@CurrentUser('id') userId: number, @Param('id', ParseIntPipe) id: number): Promise<any> {
    return { items: await this.svc.listVariants(userId, id) };
  }

  @Post('products/:id/variants')
  addVariant(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: any,
  ): any {
    return this.svc.addVariant(userId, id, body);
  }

  @Put('products/:id/variants/:variantId')
  updateVariant(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: any,
  ): any {
    return this.svc.updateVariant(userId, id, variantId, body);
  }

  @Delete('products/:id/variants/:variantId')
  removeVariant(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ): any {
    return this.svc.removeVariant(userId, id, variantId);
  }

  // Bulk CSV upsert — header: couleur,taille,sku,ean13,stock,priceAdjust
  @Post('products/:id/variants/import')
  importVariants(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { csv: string },
  ): any {
    return this.svc.importVariantsCsv(userId, id, body?.csv || '');
  }

  // ─── Fulfillment (per order item) ─────────────────────────
  @Post('orders/items/:itemId/preparing')
  prepare(@CurrentUser('id') userId: number, @Param('itemId', ParseIntPipe) itemId: number): any {
    return this.svc.markPreparing(userId, itemId);
  }

  @Post('orders/items/:itemId/ship')
  ship(
    @CurrentUser('id') userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { trackingNumber?: string; carrier?: string; trackingUrl?: string; notes?: string },
  ): any {
    return this.svc.markShipped(userId, itemId, body || {});
  }

  @Post('orders/items/:itemId/delivered')
  deliver(@CurrentUser('id') userId: number, @Param('itemId', ParseIntPipe) itemId: number): any {
    return this.svc.markDelivered(userId, itemId);
  }

  @Post('orders/items/:itemId/cancel')
  cancelFulfill(
    @CurrentUser('id') userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: { reason?: string },
  ): any {
    return this.svc.cancelFulfillment(userId, itemId, body?.reason);
  }
}
