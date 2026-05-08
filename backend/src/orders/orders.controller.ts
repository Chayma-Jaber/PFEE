import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  Req,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { Address } from '../users/entities/address.entity';
import { Product } from '../products/entities/product.entity';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    @InjectRepository(Address) private readonly addressRepo: Repository<Address>,
    @InjectRepository(Product) private readonly productRepo: Repository<Product>,
  ) {}

  // ==================== NEW ENDPOINTS ====================

  @Post('orders/create')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Create a new order' })
  async createOrder(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateOrderDto,
    @Req() req: Request,
  ) {
    const order = await this.ordersService.createOrder(userId, dto, {
      ip_address: req.ip || (req.headers['x-forwarded-for'] as string),
      user_agent: req.headers['user-agent'],
    });
    return {
      message: 'Order created successfully',
      order,
    };
  }

  @Get('orders/my-orders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get current user orders (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  async getMyOrders(
    @CurrentUser('id') userId: number,
    @Query('page') page?: number,
    @Query('status') status?: string,
  ) {
    return this.ordersService.getOrders(userId, page || 1, status);
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get order details by ID' })
  async getOrder(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const order = await this.ordersService.getOrderById(id);
    // Verify ownership
    if (order.user_id !== userId) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  @Post('orders/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel an order' })
  async cancelOrder(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason?: string,
  ) {
    const order = await this.ordersService.getOrderById(id);
    if (order.user_id !== userId) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    const cancelled = await this.ordersService.cancelOrder(id, reason);
    return { message: 'Order cancelled', order: cancelled };
  }

  @Get('orders/:id/track')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get order tracking information' })
  async trackOrder(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const order = await this.ordersService.getOrderById(id);
    if (order.user_id !== userId) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return this.ordersService.getOrderTracking(id);
  }

  // ==================== LEGACY COMPATIBILITY ENDPOINTS ====================

  @Get('getOrders')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: Get user orders' })
  async getOrdersLegacy(@CurrentUser('id') userId: number) {
    const result = await this.ordersService.getOrders(userId, 1);
    return result.orders;
  }

  @Get('getOrderById/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy: Get order by ID' })
  async getOrderByIdLegacy(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const order = await this.ordersService.getOrderById(id);
    if (order.user_id !== userId) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  // The Strapi-style endpoint the Angular checkout actually calls.
  // It accepts { orderData, products } where orderData carries IDs (shippingAddress,
  // shippingMethod, paymentMethod, coupon) and products carries [{ ean13, quantity,
  // unitPrice, discount }]. Returns Strapi's { status, data } envelope so the
  // existing checkout component (`orderResponse.status === 200 && data.id`) keeps
  // working unchanged.
  @Post('placeOrder')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Legacy Strapi-style order placement (used by Angular checkout)' })
  async placeOrderLegacy(
    @CurrentUser('id') userId: number,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const orderData = body?.orderData || {};
    const products: any[] = Array.isArray(body?.products) ? body.products : [];
    if (products.length === 0) {
      throw new BadRequestException('Order must contain at least one product');
    }

    // Resolve the shipping address from its id (legacy payload sends the id, not the
    // full object). Falls back to a minimal phone-only address for store pickup.
    let shipping_address: any = {};
    if (orderData.shippingAddress) {
      const addr = await this.addressRepo.findOne({
        where: { id: Number(orderData.shippingAddress), user_id: userId },
      });
      if (!addr) throw new NotFoundException(`Address ${orderData.shippingAddress} not found`);
      shipping_address = {
        street: addr.street || '',
        city: addr.city || '',
        state: addr.state || '',
        postal_code: addr.postal_code || '',
        country: addr.country || 'TN',
        phone: addr.phone || '',
      };
    } else if (orderData.shippingStore) {
      shipping_address = {
        street: 'Store pickup',
        city: '',
        country: 'TN',
        phone: '',
      };
    }

    // Map shipping method ids to internal keys: 1=home, 2=store-pickup.
    const shipping_method = orderData.shippingMethod === 2 ? 'pickup' : 'standard';

    // Map payment method ids: 2=CTP card, 3=COD (mirrors checkout.component.ts).
    const payment_method = orderData.paymentMethod === 2 ? 'ctp' : 'cod';

    // Resolve product_id/sku/title/image from the catalogue. Frontend sends
    // ean13 which may match either Product.sku or a ProductVariant.ean13. Items
    // without a matching product are kept (the line is still placed) but won't
    // emit stock movements server-side.
    const items = await Promise.all(
      products.map(async (p: any) => {
        const ean = String(p.ean13 || '').trim();
        let prod: Product | null = null;
        if (ean) {
          // First try product.sku, then fall back to a variant's ean13.
          prod = await this.productRepo
            .createQueryBuilder('p')
            .leftJoinAndSelect('p.images', 'img')
            .where('p.sku = :ean', { ean })
            .getOne();
          if (!prod) {
            prod = await this.productRepo
              .createQueryBuilder('p')
              .leftJoinAndSelect('p.images', 'img')
              .leftJoin('p.variants', 'v')
              .where('v.ean13 = :ean OR v.sku = :ean', { ean })
              .getOne();
          }
        }
        return {
          product_id: prod?.id,
          sku: prod?.sku || ean || undefined,
          title: prod?.title || `Article ${ean}`,
          ean13: ean || undefined,
          unit_price: Number(p.unitPrice ?? p.unit_price ?? 0),
          quantity: Number(p.quantity ?? 1),
          image_url: prod?.images?.[0]?.imageUrl,
        };
      }),
    );

    const dto: CreateOrderDto = {
      items,
      shipping_address,
      shipping_method,
      payment_method,
      coupon_code: orderData.coupon ? String(orderData.coupon) : undefined,
      notes: orderData.giftMessage,
    } as CreateOrderDto;

    const order = await this.ordersService.createOrder(userId, dto, {
      ip_address: req.ip || (req.headers['x-forwarded-for'] as string),
      user_agent: req.headers['user-agent'],
    });

    return { status: 200, data: order };
  }
}
