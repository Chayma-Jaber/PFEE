import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerSignal } from '../wave4/wave4.entities';
import { User } from '../users/entities/user.entity';
import { Order } from '../orders/entities/order.entity';
import { PropensityService } from './propensity.service';
import { PropensityAdminController } from './propensity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerSignal, User, Order])],
  controllers: [PropensityAdminController],
  providers: [PropensityService],
  exports: [PropensityService],
})
export class PropensityModule {}
