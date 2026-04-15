import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';

export class ApplyGiftCardDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsNumber()
  orderId: number;

  @IsNumber()
  @Min(0.01)
  amount: number;
}
