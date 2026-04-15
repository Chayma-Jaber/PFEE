import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { TicketStatus } from '../entities/support-ticket.entity';

export class TicketQueryDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;

  @IsEnum(TicketStatus)
  @IsOptional()
  status?: TicketStatus;
}
