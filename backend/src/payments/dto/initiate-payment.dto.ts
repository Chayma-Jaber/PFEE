import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InitiateCtpDto {
  @IsInt()
  @IsNotEmpty()
  order_id: number;

  @IsString()
  @IsNotEmpty()
  redirect_url: string;

  @IsString()
  @IsOptional()
  cancel_url?: string;
}

export class LegacyGenerateCtpDto {
  @IsInt()
  @IsNotEmpty()
  orderId: number;

  @IsString()
  @IsNotEmpty()
  redirectTo: string;
}

export class LegacyCheckCtpDto {
  @IsInt()
  @IsNotEmpty()
  orderId: number;
}
