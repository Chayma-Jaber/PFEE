import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';

export class AddCartItemDto {
  @IsInt()
  @IsNotEmpty()
  product_id: number;

  @IsObject()
  @IsOptional()
  variant_info?: Record<string, any>;

  @IsInt()
  @Min(1)
  @IsOptional()
  quantity?: number = 1;
}

export class UpdateCartQuantityDto {
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  quantity: number;
}
