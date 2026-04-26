import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LifecycleSequence } from './entities/lifecycle-sequence.entity';
import { LifecycleEnrollment } from './entities/lifecycle-enrollment.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { LifecycleService } from './lifecycle.service';
import { LifecycleAdminController } from './lifecycle.controller';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LifecycleSequence, LifecycleEnrollment, User, Notification]),
    EmailModule,
    SmsModule,
  ],
  controllers: [LifecycleAdminController],
  providers: [LifecycleService],
  exports: [LifecycleService],
})
export class LifecycleModule {}
