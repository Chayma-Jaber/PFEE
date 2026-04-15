import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { WishlistItem } from './entities/wishlist-item.entity';
import { WishlistCollection } from './entities/wishlist-collection.entity';
import {
  CreateCollectionDto,
  UpdateCollectionDto,
  MoveItemDto,
} from './dto/wishlist.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly itemRepo: Repository<WishlistItem>,
    @InjectRepository(WishlistCollection)
    private readonly collectionRepo: Repository<WishlistCollection>,
  ) {}

  // ── Legacy endpoints ─────────────────────────────────────────

  async addItem(userId: number, productId: number): Promise<WishlistItem> {
    const existing = await this.itemRepo.findOne({
      where: { user_id: userId, product_id: productId },
    });
    if (existing) {
      throw new BadRequestException('Product already in wishlist');
    }
    const item = this.itemRepo.create({
      user_id: userId,
      product_id: productId,
    });
    return this.itemRepo.save(item);
  }

  async getItems(userId: number): Promise<WishlistItem[]> {
    return this.itemRepo.find({
      where: { user_id: userId },
      order: { added_at: 'DESC' },
    });
  }

  async removeItem(userId: number, id: number): Promise<void> {
    const item = await this.itemRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }
    await this.itemRepo.remove(item);
  }

  // ── Collections ──────────────────────────────────────────────

  async listCollections(
    userId: number,
    includeItems: boolean,
  ): Promise<WishlistCollection[]> {
    const relations = includeItems ? ['items'] : [];
    return this.collectionRepo.find({
      where: { user_id: userId },
      relations,
      order: { created_at: 'DESC' },
    });
  }

  async createCollection(
    userId: number,
    dto: CreateCollectionDto,
  ): Promise<WishlistCollection> {
    const collection = this.collectionRepo.create({
      user_id: userId,
      name: dto.name,
      description: dto.description,
      is_public: dto.isPublic ?? false,
    });
    return this.collectionRepo.save(collection);
  }

  async getCollection(
    userId: number,
    id: number,
  ): Promise<WishlistCollection> {
    const collection = await this.collectionRepo.findOne({
      where: { id, user_id: userId },
      relations: ['items'],
    });
    if (!collection) {
      throw new NotFoundException('Collection not found');
    }
    return collection;
  }

  async updateCollection(
    userId: number,
    id: number,
    dto: UpdateCollectionDto,
  ): Promise<WishlistCollection> {
    const collection = await this.getCollection(userId, id);
    if (dto.name !== undefined) collection.name = dto.name;
    if (dto.description !== undefined) collection.description = dto.description;
    if (dto.isPublic !== undefined) collection.is_public = dto.isPublic;
    return this.collectionRepo.save(collection);
  }

  async deleteCollection(
    userId: number,
    id: number,
    moveItemsTo?: number,
  ): Promise<void> {
    const collection = await this.getCollection(userId, id);

    if (moveItemsTo) {
      // Verify target collection exists and belongs to user
      const target = await this.collectionRepo.findOne({
        where: { id: moveItemsTo, user_id: userId },
      });
      if (!target) {
        throw new NotFoundException('Target collection not found');
      }
      await this.itemRepo.update(
        { collection_id: id, user_id: userId },
        { collection_id: moveItemsTo },
      );
    } else {
      // Orphan items (set collection_id to null)
      await this.itemRepo.update(
        { collection_id: id, user_id: userId },
        { collection_id: null },
      );
    }

    await this.collectionRepo.remove(collection);
  }

  // ── Items within collections ─────────────────────────────────

  async getAllItems(
    userId: number,
    collectionId?: number,
  ): Promise<WishlistItem[]> {
    const where: any = { user_id: userId };
    if (collectionId !== undefined) {
      where.collection_id = collectionId === 0 ? IsNull() : collectionId;
    }
    return this.itemRepo.find({
      where,
      order: { added_at: 'DESC' },
    });
  }

  async moveItem(userId: number, dto: MoveItemDto): Promise<WishlistItem> {
    const item = await this.itemRepo.findOne({
      where: { user_id: userId, product_id: dto.product_id },
    });
    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    if (dto.target_collection_id) {
      const collection = await this.collectionRepo.findOne({
        where: { id: dto.target_collection_id, user_id: userId },
      });
      if (!collection) {
        throw new NotFoundException('Target collection not found');
      }
    }

    item.collection_id = dto.target_collection_id ?? null;
    return this.itemRepo.save(item);
  }

  async removeItemById(userId: number, id: number): Promise<void> {
    const item = await this.itemRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }
    await this.itemRepo.remove(item);
  }

  async updateItemNotes(
    userId: number,
    id: number,
    notes: string,
  ): Promise<WishlistItem> {
    const item = await this.itemRepo.findOne({
      where: { id, user_id: userId },
    });
    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }
    item.notes = notes;
    return this.itemRepo.save(item);
  }

  // ── Sharing ──────────────────────────────────────────────────

  async toggleSharing(
    userId: number,
    id: number,
  ): Promise<WishlistCollection> {
    const collection = await this.getCollection(userId, id);
    collection.is_public = !collection.is_public;

    if (collection.is_public && !collection.share_token) {
      collection.share_token = uuidv4();
    }

    if (!collection.is_public) {
      collection.share_token = null;
    }

    return this.collectionRepo.save(collection);
  }

  async getSharedCollection(token: string): Promise<WishlistCollection> {
    const collection = await this.collectionRepo.findOne({
      where: { share_token: token, is_public: true },
      relations: ['items'],
    });
    if (!collection) {
      throw new NotFoundException('Shared collection not found');
    }
    return collection;
  }
}
