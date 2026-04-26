import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { B2BAccount } from './entities/b2b-account.entity';
import { B2BQuote } from './entities/b2b-quote.entity';
import { Product } from '../products/entities/product.entity';
import { B2BService } from './b2b.service';
import { B2BStorefrontController, B2BAdminController } from './b2b.controller';

@Module({
  imports: [TypeOrmModule.forFeature([B2BAccount, B2BQuote, Product])],
  controllers: [B2BStorefrontController, B2BAdminController],
  providers: [B2BService],
  exports: [B2BService],
})
export class B2BModule {}
