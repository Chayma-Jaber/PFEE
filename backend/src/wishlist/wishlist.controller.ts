import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WishlistService } from './wishlist.service';
import {
  AddWishlistItemDto,
  CreateCollectionDto,
  UpdateCollectionDto,
  MoveItemDto,
  UpdateNotesDto,
} from './dto/wishlist.dto';

@Controller()
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  // ── Legacy endpoints ─────────────────────────────────────────

  @Post('addWishListItem')
  @UseGuards(JwtAuthGuard)
  async addWishListItem(
    @CurrentUser('id') userId: number,
    @Body() dto: AddWishlistItemDto,
  ) {
    const item = await this.wishlistService.addItem(userId, dto.idProduct);
    return { success: true, item };
  }

  @Get('getWishListItems')
  @UseGuards(JwtAuthGuard)
  async getWishListItems(@CurrentUser('id') userId: number) {
    const items = await this.wishlistService.getItems(userId);
    return {
      success: true,
      items,
      data: items.map((item) => ({
        id: item.product_id,
        product_id: item.product_id,
        wishlist_item_id: item.id,
      })),
    };
  }

  @Delete('removeWishListItem/:id')
  @UseGuards(JwtAuthGuard)
  async removeWishListItem(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.wishlistService.removeItem(userId, id);
    return { success: true, message: 'Item removed from wishlist' };
  }

  // ── Collections endpoints ────────────────────────────────────

  @Get('wishlist/collections')
  @UseGuards(JwtAuthGuard)
  async listCollections(
    @CurrentUser('id') userId: number,
    @Query('include_items') includeItems?: string,
  ) {
    const include = includeItems === 'true' || includeItems === '1';
    const collections = await this.wishlistService.listCollections(
      userId,
      include,
    );
    return { success: true, collections };
  }

  @Post('wishlist/collections')
  @UseGuards(JwtAuthGuard)
  async createCollection(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCollectionDto,
  ) {
    const collection = await this.wishlistService.createCollection(userId, dto);
    return { success: true, collection };
  }

  @Get('wishlist/collections/items/all')
  @UseGuards(JwtAuthGuard)
  async getAllItems(
    @CurrentUser('id') userId: number,
    @Query('collection_id') collectionId?: string,
  ) {
    const colId = collectionId ? parseInt(collectionId, 10) : undefined;
    const items = await this.wishlistService.getAllItems(userId, colId);
    return { success: true, items };
  }

  @Get('wishlist/collections/shared/:token')
  async getSharedCollection(@Param('token') token: string) {
    const collection = await this.wishlistService.getSharedCollection(token);
    return { success: true, collection };
  }

  @Get('wishlist/collections/:id')
  @UseGuards(JwtAuthGuard)
  async getCollection(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const collection = await this.wishlistService.getCollection(userId, id);
    return { success: true, collection };
  }

  @Put('wishlist/collections/:id')
  @UseGuards(JwtAuthGuard)
  async updateCollection(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
  ) {
    const collection = await this.wishlistService.updateCollection(
      userId,
      id,
      dto,
    );
    return { success: true, collection };
  }

  @Delete('wishlist/collections/:id')
  @UseGuards(JwtAuthGuard)
  async deleteCollection(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Query('move_items_to') moveItemsTo?: string,
  ) {
    const targetId = moveItemsTo ? parseInt(moveItemsTo, 10) : undefined;
    await this.wishlistService.deleteCollection(userId, id, targetId);
    return { success: true, message: 'Collection deleted' };
  }

  @Post('wishlist/collections/items/move')
  @UseGuards(JwtAuthGuard)
  async moveItem(
    @CurrentUser('id') userId: number,
    @Body() dto: MoveItemDto,
  ) {
    const item = await this.wishlistService.moveItem(userId, dto);
    return { success: true, item };
  }

  @Delete('wishlist/collections/items/:id')
  @UseGuards(JwtAuthGuard)
  async removeCollectionItem(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.wishlistService.removeItemById(userId, id);
    return { success: true, message: 'Item removed' };
  }

  @Put('wishlist/collections/items/:id/notes')
  @UseGuards(JwtAuthGuard)
  async updateItemNotes(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotesDto,
  ) {
    const item = await this.wishlistService.updateItemNotes(
      userId,
      id,
      dto.notes,
    );
    return { success: true, item };
  }

  @Post('wishlist/collections/:id/toggle-sharing')
  @UseGuards(JwtAuthGuard)
  async toggleSharing(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const collection = await this.wishlistService.toggleSharing(userId, id);
    return {
      success: true,
      collection,
      sharing_enabled: collection.is_public,
      share_token: collection.share_token,
    };
  }
}
