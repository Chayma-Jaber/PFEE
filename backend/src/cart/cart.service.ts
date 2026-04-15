import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CartItem } from './entities/cart-item.entity';
import { AddCartItemDto } from './dto/add-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(CartItem)
    private readonly cartRepo: Repository<CartItem>,
  ) {}

  async getCart(userId: number): Promise<CartItem[]> {
    return this.cartRepo.find({
      where: { user_id: userId },
      order: { added_at: 'DESC' },
    });
  }

  async addItem(userId: number, dto: AddCartItemDto): Promise<CartItem> {
    // Check if the same product + variant already exists in cart
    const existing = await this.cartRepo.findOne({
      where: {
        user_id: userId,
        product_id: dto.product_id,
      },
    });

    if (existing) {
      // Compare variant_info
      const sameVariant =
        JSON.stringify(existing.variant_info) ===
        JSON.stringify(dto.variant_info || null);

      if (sameVariant) {
        existing.quantity = Math.min(10, existing.quantity + (dto.quantity || 1));
        return this.cartRepo.save(existing);
      }
    }

    const item = this.cartRepo.create({
      user_id: userId,
      product_id: dto.product_id,
      variant_info: dto.variant_info || null,
      quantity: dto.quantity || 1,
    });

    return this.cartRepo.save(item);
  }

  async updateQuantity(
    userId: number,
    itemId: number,
    quantity: number,
  ): Promise<CartItem> {
    const item = await this.cartRepo.findOne({
      where: { id: itemId, user_id: userId },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    item.quantity = Math.min(10, quantity);
    return this.cartRepo.save(item);
  }

  async removeItem(userId: number, itemId: number): Promise<void> {
    const item = await this.cartRepo.findOne({
      where: { id: itemId, user_id: userId },
    });

    if (!item) {
      throw new NotFoundException('Cart item not found');
    }

    await this.cartRepo.remove(item);
  }

  async clearCart(userId: number): Promise<void> {
    await this.cartRepo.delete({ user_id: userId });
  }
}
