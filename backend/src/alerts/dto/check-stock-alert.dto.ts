import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CheckStockAlertDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  color?: string;
}
