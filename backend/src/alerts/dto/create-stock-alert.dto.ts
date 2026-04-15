import { IsNumber, IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateStockAlertDto {
  @IsNumber()
  product_id: number;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  product_name?: string;

  @IsString()
  @IsOptional()
  product_image?: string;

  @IsNumber()
  @IsOptional()
  product_price?: number;
}
