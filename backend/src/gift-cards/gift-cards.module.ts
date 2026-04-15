import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiftCard } from './entities/gift-card.entity';
import { StoreCredit } from './entities/store-credit.entity';
import { GiftCardsService } from './gift-cards.service';
import { GiftCardsController } from './gift-cards.controller';

@Module({
  imports: [TypeOrmModule.forFeature([GiftCard, StoreCredit])],
  controllers: [GiftCardsController],
  providers: [GiftCardsService],
  exports: [GiftCardsService],
})
export class GiftCardsModule {}
