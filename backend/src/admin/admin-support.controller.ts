import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SkipTransform } from '../common/decorators/skip-transform.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  SupportTicket,
  TicketStatus,
} from '../support/entities/support-ticket.entity';
import {
  TicketMessage,
  SenderType,
} from '../support/entities/ticket-message.entity';
import { User } from '../users/entities/user.entity';

@Controller('admin/support')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN', 'ADMIN')
@SkipTransform()
export class AdminSupportController {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepo: Repository<TicketMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ─── Tickets List ───────────────────────────────────────────────────

  @Get('tickets')
  async getTickets(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
  ) {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.user', 'u')
      .orderBy('t.created_at', 'DESC');

    if (status) {
      qb.andWhere('t.status = :status', { status: status.toUpperCase() });
    }
    if (priority) {
      qb.andWhere('t.priority = :priority', { priority: priority.toUpperCase() });
    }
    if (search) {
      qb.andWhere(
        '(t.subject LIKE :search OR t.description LIKE :search OR t.contact_name LIKE :search OR t.contact_email LIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();
    const tickets = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      tickets,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Ticket Stats ──────────────────────────────────────────────────

  @Get('tickets/stats')
  async getStats() {
    const total = await this.ticketRepo.count();
    const open = await this.ticketRepo.count({ where: { status: TicketStatus.OPEN } });
    const in_progress = await this.ticketRepo.count({ where: { status: TicketStatus.IN_PROGRESS } });
    const resolved = await this.ticketRepo.count({ where: { status: TicketStatus.RESOLVED } });
    const closed = await this.ticketRepo.count({ where: { status: TicketStatus.CLOSED } });
    const unassigned = await this.ticketRepo
      .createQueryBuilder('t')
      .where('t.assigned_to IS NULL')
      .andWhere('t.status IN (:...statuses)', { statuses: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] })
      .getCount();
    const urgent = await this.ticketRepo
      .createQueryBuilder('t')
      .where('t.priority = :priority', { priority: 'urgent' })
      .andWhere('t.status NOT IN (:...done)', { done: [TicketStatus.RESOLVED, TicketStatus.CLOSED] })
      .getCount();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const todayCreated = await this.ticketRepo
      .createQueryBuilder('t')
      .where('t.created_at >= :today', { today: todayStart })
      .getCount();

    // Calculate average response time (time from creation to first agent message)
    let avg_response_time = '0h';
    try {
      const result = await this.ticketRepo
        .createQueryBuilder('t')
        .innerJoin('t.messages', 'm', "m.sender_type = :agent", { agent: SenderType.AGENT })
        .select('AVG(DATEDIFF(MINUTE, t.created_at, m.created_at))', 'avg_minutes')
        .getRawOne();
      if (result?.avg_minutes) {
        const mins = Math.round(parseFloat(result.avg_minutes));
        if (mins < 60) {
          avg_response_time = `${mins}m`;
        } else {
          avg_response_time = `${Math.round(mins / 60)}h`;
        }
      }
    } catch {
      // If the query fails (e.g. no messages), just use default
    }

    return { total, open, in_progress, resolved, closed, unassigned, urgent, overdue: 0, todayCreated, byCategory: {}, avg_response_time };
  }

  // ─── Single Ticket ─────────────────────────────────────────────────

  @Get('tickets/:id')
  async getTicket(@Param('id', ParseIntPipe) id: number) {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['user', 'messages'],
    });
    if (!ticket) throw new NotFoundException('Ticket not found');
    return ticket;
  }

  // ─── Agents ─────────────────────────────────────────────────────────

  @Get('agents')
  async getAgents() {
    const agents = await this.userRepo
      .createQueryBuilder('u')
      .where("u.role != :role", { role: 'customer' })
      .andWhere("u.role != :role2", { role2: 'CUSTOMER' })
      .select(['u.id', 'u.first_name', 'u.last_name', 'u.email', 'u.role'])
      .getMany();
    return { agents };
  }

  // ─── Assign ─────────────────────────────────────────────────────────

  @Post('tickets/:id/assign')
  async assignTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { agent_id: number },
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.assigned_to = body.agent_id;
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }
    await this.ticketRepo.save(ticket);
    return ticket;
  }

  // ─── Update Ticket ─────────────────────────────────────────────────

  @Put('tickets/:id')
  async updateTicket(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; priority?: string; category?: string },
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    if (body.status) ticket.status = body.status as any;
    if (body.priority) ticket.priority = body.priority as any;
    if (body.category) ticket.category = body.category as any;

    await this.ticketRepo.save(ticket);
    return ticket;
  }

  // ─── Add Message ───────────────────────────────────────────────────

  @Post('tickets/:id/messages')
  async addMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { message: string; is_internal?: boolean },
    @CurrentUser('id') adminId: number,
  ) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    const msg = this.messageRepo.create({
      ticket_id: id,
      sender_id: adminId,
      sender_type: SenderType.AGENT,
      message: body.message,
      is_internal: body.is_internal || false,
    });

    const saved = await this.messageRepo.save(msg);

    // Update ticket status if still OPEN
    if (ticket.status === TicketStatus.OPEN) {
      ticket.status = TicketStatus.IN_PROGRESS;
      await this.ticketRepo.save(ticket);
    }

    return saved;
  }

  // ─── Resolve ───────────────────────────────────────────────────────

  @Post('tickets/:id/resolve')
  async resolveTicket(@Param('id', ParseIntPipe) id: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.status = TicketStatus.RESOLVED;
    ticket.resolved_at = new Date();
    await this.ticketRepo.save(ticket);
    return ticket;
  }

  // ─── Close ─────────────────────────────────────────────────────────

  @Post('tickets/:id/close')
  async closeTicket(@Param('id', ParseIntPipe) id: number) {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) throw new NotFoundException('Ticket not found');

    ticket.status = TicketStatus.CLOSED;
    ticket.closed_at = new Date();
    await this.ticketRepo.save(ticket);
    return ticket;
  }
}
