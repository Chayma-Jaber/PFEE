import {
  IsString,
  IsEnum,
  IsOptional,
  IsEmail,
  IsNumber,
  MinLength,
  MaxLength,
} from 'class-validator';
import { TicketCategory, TicketPriority } from '../entities/support-ticket.entity';

export class CreateTicketDto {
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(10)
  description: string;

  @IsEnum(TicketCategory)
  @IsOptional()
  category?: TicketCategory;

  @IsEnum(TicketPriority)
  @IsOptional()
  priority?: TicketPriority;

  @IsEmail()
  @IsOptional()
  contact_email?: string;

  @IsString()
  @IsOptional()
  contact_phone?: string;

  @IsString()
  @IsOptional()
  contact_name?: string;

  @IsNumber()
  @IsOptional()
  order_id?: number;

  @IsNumber()
  @IsOptional()
  product_id?: number;
}
