import { IsOptional, IsNumber, Min } from 'class-validator';

export class AlertQueryDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 10;
}
