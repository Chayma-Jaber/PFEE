import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailTrackingController } from './email-tracking.controller';
import { EmailAdminController } from './email-admin.controller';
import { EmailLog } from './entities/email-log.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailLog])],
  controllers: [EmailTrackingController, EmailAdminController],
  providers: [EmailService],
  exports: [EmailService, TypeOrmModule],
})
export class EmailModule {}
