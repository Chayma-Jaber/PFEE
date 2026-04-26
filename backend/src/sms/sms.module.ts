import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SmsService } from './sms.service';
import { SmsAdminController } from './sms.controller';
import { SmsMessage } from './entities/sms-message.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SmsMessage])],
  controllers: [SmsAdminController],
  providers: [SmsService],
  exports: [SmsService, TypeOrmModule],
})
export class SmsModule {}
