import {
  IsNumber,
  IsEmail,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

export class PurchaseGiftCardDto {
  @IsNumber()
  @Min(1)
  @Max(10000)
  amount: number;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  recipientName: string;

  @IsOptional()
  @IsString()
  message?: string;
}
