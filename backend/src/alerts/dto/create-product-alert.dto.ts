import { IsNumber, IsEmail, IsOptional } from 'class-validator';

export class CreatePriceDropAlertDto {
  @IsNumber()
  product_id: number;

  @IsEmail()
  email: string;

  @IsNumber()
  @IsOptional()
  target_price?: number;

  @IsNumber()
  current_price: number;
}

export class CreateBackInStockAlertDto {
  @IsNumber()
  product_id: number;

  @IsEmail()
  email: string;

  @IsNumber()
  current_price: number;
}
