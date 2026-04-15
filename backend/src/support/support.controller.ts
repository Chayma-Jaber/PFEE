import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';

@Controller('support/tickets')
@UseGuards(JwtAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  async createTicket(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateTicketDto,
  ) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get()
  async listTickets(
    @CurrentUser('id') userId: number,
    @Query() query: TicketQueryDto,
  ) {
    return this.supportService.findUserTickets(userId, query);
  }

  @Get(':id')
  async getTicket(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) ticketId: number,
  ) {
    return this.supportService.findTicketById(ticketId, userId);
  }

  @Post(':id/messages')
  async addMessage(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) ticketId: number,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.supportService.addMessage(ticketId, userId, dto);
  }

  @Post(':id/close')
  async closeTicket(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) ticketId: number,
  ) {
    return this.supportService.closeTicket(ticketId, userId);
  }
}
