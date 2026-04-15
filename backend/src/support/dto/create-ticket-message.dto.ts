import { IsString, IsOptional, IsArray, IsBoolean, MinLength } from 'class-validator';

export class CreateTicketMessageDto {
  @IsString()
  @MinLength(1)
  message: string;

  @IsArray()
  @IsOptional()
  attachments?: string[];

  @IsBoolean()
  @IsOptional()
  is_internal?: boolean;
}
