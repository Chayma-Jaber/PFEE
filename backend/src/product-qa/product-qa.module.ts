import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductQA } from './entities/product-qa.entity';
import { ProductQAService } from './product-qa.service';
import { ProductQAController } from './product-qa.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProductQA])],
  controllers: [ProductQAController],
  providers: [ProductQAService],
  exports: [ProductQAService],
})
export class ProductQAModule {}
