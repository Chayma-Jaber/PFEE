import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReturnRequest, ReturnStatus } from './entities/return-request.entity';
import { Order } from './entities/order.entity';
import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

class CreateReturnRequestDto {
  @IsNumber()
  order_id: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  items?: any[];

  @IsOptional()
  @IsArray()
  photos?: string[];
}

@Controller()
export class ReturnsController {
  constructor(
    @InjectRepository(ReturnRequest)
    private returnRepo: Repository<ReturnRequest>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  @Get('availablesOrdersForReturnRequest')
  @UseGuards(JwtAuthGuard)
  async getAvailableOrders(@CurrentUser('id') userId: number) {
    // Orders that are delivered and not yet returned
    const orders = await this.orderRepo
      .createQueryBuilder('order')
      .where('order.user_id = :userId', { userId })
      .andWhere('order.status IN (:...statuses)', {
        statuses: ['delivered', 'completed'],
      })
      .leftJoinAndSelect('order.items', 'items')
      .orderBy('order.delivered_at', 'DESC')
      .getMany();

    // Filter out orders with existing return requests
    const returnedOrderIds = await this.returnRepo
      .createQueryBuilder('r')
      .select('r.order_id')
      .where('r.user_id = :userId', { userId })
      .andWhere('r.status NOT IN (:...statuses)', {
        statuses: [ReturnStatus.REJECTED, ReturnStatus.CLOSED],
      })
      .getRawMany();

    const returnedIds = new Set(returnedOrderIds.map((r) => r.r_order_id));
    return orders.filter((o) => !returnedIds.has(o.id));
  }

  @Get('availablesOrderProductsForReturn/:orderId')
  @UseGuards(JwtAuthGuard)
  async getAvailableProducts(
    @CurrentUser('id') userId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, user_id: userId },
      relations: ['items'],
    });

    if (!order) return [];
    return order.items || [];
  }

  @Post('createOrderReturnRequest')
  @UseGuards(JwtAuthGuard)
  async createReturnRequest(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateReturnRequestDto,
  ) {
    const order = await this.orderRepo.findOne({
      where: { id: dto.order_id, user_id: userId },
    });

    if (!order) {
      return { success: false, message: 'Order not found' };
    }

    const returnRequest = this.returnRepo.create({
      order_id: dto.order_id,
      user_id: userId,
      reason: dto.reason,
      description: dto.description,
      items: dto.items,
      photos: dto.photos,
      status: ReturnStatus.PENDING,
    });

    const saved = await this.returnRepo.save(returnRequest);
    return { success: true, return: saved };
  }

  @Get('getOrdersReturns')
  @UseGuards(JwtAuthGuard)
  async getUserReturns(@CurrentUser('id') userId: number) {
    return this.returnRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  @Get('getOrderReturnById/:id')
  @UseGuards(JwtAuthGuard)
  async getReturnById(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.returnRepo.findOne({
      where: { id, user_id: userId },
    });
  }
}
