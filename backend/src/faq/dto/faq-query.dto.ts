import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class FaqSearchDto {
  @IsString()
  q: string;
}

export class FaqFeaturedDto {
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 5;
}
