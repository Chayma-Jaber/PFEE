import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { ContactController } from './contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, TicketMessage])],
  controllers: [SupportController, ContactController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
