import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { AiStylistService } from './ai-stylist.service';
import { AiStylistController } from './ai-stylist.controller';
import { Product } from '../products/entities/product.entity';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([Product, Order])],
  controllers: [AiController, AiStylistController],
  providers: [AiService, AiStylistService],
  exports: [AiService, AiStylistService],
})
export class AiModule {}
