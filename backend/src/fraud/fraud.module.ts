import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudSignal } from './entities/fraud-signal.entity';
import { DeviceFingerprint } from './entities/device-fingerprint.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { FraudService } from './fraud.service';
import { FraudStorefrontController, FraudAdminController } from './fraud.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FraudSignal, DeviceFingerprint, Order, User])],
  controllers: [FraudStorefrontController, FraudAdminController],
  providers: [FraudService],
  exports: [FraudService],
})
export class FraudModule {}
