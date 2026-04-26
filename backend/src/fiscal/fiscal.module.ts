import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiscalReceipt } from './entities/fiscal-receipt.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { FiscalService } from './fiscal.service';
import { FiscalAdminController } from './fiscal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FiscalReceipt, Order, User])],
  controllers: [FiscalAdminController],
  providers: [FiscalService],
  exports: [FiscalService],
})
export class FiscalModule {}
