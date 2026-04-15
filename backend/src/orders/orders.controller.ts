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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('Orders')
@Controller()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

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
}
