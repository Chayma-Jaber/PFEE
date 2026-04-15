import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsArray,
  IsNotEmpty,
  IsDateString,
  ValidateNested,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class BundleItemDto {
  @IsNumber()
  @IsNotEmpty()
  product_id: number;

  @IsInt()
  @IsOptional()
  quantity?: number;

  @IsInt()
  @IsOptional()
  position?: number;
}

export class CreateBundleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  bundle_price: number;

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  original_price: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  savings_amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discount_percentage?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @IsDateString()
  @IsOptional()
  valid_to?: string;

  @IsInt()
  @IsOptional()
  max_purchases?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  @IsOptional()
  items?: BundleItemDto[];
}

export class UpdateBundleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  image_url?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  bundle_price?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  original_price?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  savings_amount?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  discount_percentage?: number;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @IsDateString()
  @IsOptional()
  valid_from?: string;

  @IsDateString()
  @IsOptional()
  valid_to?: string;

  @IsInt()
  @IsOptional()
  max_purchases?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BundleItemDto)
  @IsOptional()
  items?: BundleItemDto[];
}

export class AddBundleToCartDto {
  @IsArray()
  @IsOptional()
  selected_variants?: Record<string, any>[];
}
