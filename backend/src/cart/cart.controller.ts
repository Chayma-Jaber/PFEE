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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CartService } from './cart.service';
import { AddCartItemDto, UpdateCartQuantityDto } from './dto/add-cart-item.dto';

@ApiTags('Cart')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user cart' })
  async getCart(@CurrentUser('id') userId: number) {
    const items = await this.cartService.getCart(userId);
    return { items, count: items.length };
  }

  @Post()
  @ApiOperation({ summary: 'Add item to cart' })
  async addItem(
    @CurrentUser('id') userId: number,
    @Body() dto: AddCartItemDto,
  ) {
    const item = await this.cartService.addItem(userId, dto);
    return { message: 'Item added to cart', item };
  }

  @Put(':itemId')
  @ApiOperation({ summary: 'Update cart item quantity' })
  async updateQuantity(
    @CurrentUser('id') userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() dto: UpdateCartQuantityDto,
  ) {
    const item = await this.cartService.updateQuantity(
      userId,
      itemId,
      dto.quantity,
    );
    return { message: 'Quantity updated', item };
  }

  @Delete(':itemId')
  @ApiOperation({ summary: 'Remove item from cart' })
  async removeItem(
    @CurrentUser('id') userId: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    await this.cartService.removeItem(userId, itemId);
    return { message: 'Item removed from cart' };
  }

  @Delete()
  @ApiOperation({ summary: 'Clear entire cart' })
  async clearCart(@CurrentUser('id') userId: number) {
    await this.cartService.clearCart(userId);
    return { message: 'Cart cleared' };
  }
}
