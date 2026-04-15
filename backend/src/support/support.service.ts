import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket, TicketStatus } from './entities/support-ticket.entity';
import { TicketMessage, SenderType } from './entities/ticket-message.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateTicketMessageDto } from './dto/create-ticket-message.dto';
import { TicketQueryDto } from './dto/ticket-query.dto';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
  ) {}

  async createTicket(userId: number, dto: CreateTicketDto): Promise<SupportTicket> {
    const ticket = this.ticketRepo.create({
      ...dto,
      user_id: userId,
      status: TicketStatus.OPEN,
    });

    const saved = await this.ticketRepo.save(ticket);

    // Create initial message from the description
    const initialMessage = this.messageRepo.create({
      ticket_id: saved.id,
      sender_id: userId,
      sender_type: SenderType.CUSTOMER,
      message: dto.description,
    });
    await this.messageRepo.save(initialMessage);

    return this.findTicketById(saved.id, userId);
  }

  async findUserTickets(
    userId: number,
    query: TicketQueryDto,
  ): Promise<{ tickets: SupportTicket[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;

    const qb = this.ticketRepo
      .createQueryBuilder('ticket')
      .where('ticket.user_id = :userId', { userId })
      .orderBy('ticket.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }

    const [tickets, total] = await qb.getManyAndCount();

    return { tickets, total, page, limit };
  }

  async findTicketById(ticketId: number, userId: number): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['messages'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket #${ticketId} not found`);
    }

    if (ticket.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    // Filter out internal messages for customers
    ticket.messages = (ticket.messages || []).filter((m) => !m.is_internal);

    return ticket;
  }

  async addMessage(
    ticketId: number,
    userId: number,
    dto: CreateTicketMessageDto,
  ): Promise<TicketMessage> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });

    if (!ticket) {
      throw new NotFoundException(`Ticket #${ticketId} not found`);
    }

    if (ticket.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Cannot add messages to a closed ticket');
    }

    const message = this.messageRepo.create({
      ticket_id: ticketId,
      sender_id: userId,
      sender_type: SenderType.CUSTOMER,
      message: dto.message,
      attachments: dto.attachments || null,
      is_internal: false,
    });

    const saved = await this.messageRepo.save(message);

    // Update ticket status back to OPEN if it was waiting for customer
    if (ticket.status === TicketStatus.WAITING_CUSTOMER) {
      await this.ticketRepo.update(ticketId, { status: TicketStatus.OPEN });
    }

    return saved;
  }

  async closeTicket(ticketId: number, userId: number): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });

    if (!ticket) {
      throw new NotFoundException(`Ticket #${ticketId} not found`);
    }

    if (ticket.user_id !== userId) {
      throw new ForbiddenException('You do not have access to this ticket');
    }

    if (ticket.status === TicketStatus.CLOSED) {
      throw new BadRequestException('Ticket is already closed');
    }

    await this.ticketRepo.update(ticketId, {
      status: TicketStatus.CLOSED,
      closed_at: new Date(),
    });

    // Add system message
    const systemMessage = this.messageRepo.create({
      ticket_id: ticketId,
      sender_type: SenderType.SYSTEM,
      message: 'Ticket closed by customer.',
      is_internal: false,
    });
    await this.messageRepo.save(systemMessage);

    return this.findTicketById(ticketId, userId);
  }
}
