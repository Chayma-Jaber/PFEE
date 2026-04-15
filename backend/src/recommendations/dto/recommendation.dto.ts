import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RecommendationStrategy } from '../entities/recommendation.entity';

export class RecommendationQueryDto {
  @ApiPropertyOptional({ description: 'Product ID for context-aware recommendations' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  product_id?: number;

  @ApiPropertyOptional({ description: 'Category ID filter' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  category_id?: number;

  @ApiPropertyOptional({ description: 'Max number of recommendations', default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Page context',
    enum: ['homepage', 'pdp', 'cart', 'category', 'search'],
  })
  @IsOptional()
  @IsString()
  context?: string;
}

export class PersonalizedRecommendationDto {
  @ApiPropertyOptional({ description: 'Recently viewed product IDs' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  viewed_product_ids?: number[];

  @ApiPropertyOptional({ description: 'Recently purchased product IDs' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  purchased_product_ids?: number[];

  @ApiPropertyOptional({ description: 'Preferred categories' })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  preferred_category_ids?: number[];

  @ApiPropertyOptional({ default: 12 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}

export class RecommendationItemResponse {
  @ApiProperty()
  id: number;

  @ApiProperty()
  product_id: number;

  @ApiProperty()
  score: number;

  @ApiProperty()
  reason: string;

  @ApiProperty({ enum: RecommendationStrategy })
  strategy: RecommendationStrategy;
}

export class RecommendationMetadataResponse {
  @ApiProperty({ enum: RecommendationStrategy })
  strategy: RecommendationStrategy;

  @ApiProperty()
  count: number;

  @ApiProperty()
  cached: boolean;
}

export class RecommendationResponse {
  @ApiProperty({ type: [RecommendationItemResponse] })
  recommendations: RecommendationItemResponse[];

  @ApiProperty({ type: RecommendationMetadataResponse })
  metadata: RecommendationMetadataResponse;
}
