import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOutfitDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsArray()
  @IsOptional()
  style_tags?: string[];

  @IsString()
  @IsOptional()
  occasion?: string;

  @IsArray()
  @IsOptional()
  products?: number[];

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  total_price?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  savings?: number;

  @IsBoolean()
  @IsOptional()
  is_published?: boolean;
}

export class UpdateOutfitDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsArray()
  @IsOptional()
  style_tags?: string[];

  @IsString()
  @IsOptional()
  occasion?: string;

  @IsArray()
  @IsOptional()
  products?: number[];

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  total_price?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  savings?: number;

  @IsBoolean()
  @IsOptional()
  is_published?: boolean;
}
