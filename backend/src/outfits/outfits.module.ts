import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outfit } from './entities/outfit.entity';
import { OutfitsService } from './outfits.service';
import { OutfitsController } from './outfits.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Outfit])],
  controllers: [OutfitsController],
  providers: [OutfitsService],
  exports: [OutfitsService],
})
export class OutfitsModule {}
