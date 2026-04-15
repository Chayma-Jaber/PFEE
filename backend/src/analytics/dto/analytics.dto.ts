import {
  IsString,
  IsOptional,
  IsInt,
  IsObject,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrackEventDto {
  @IsString()
  session_id: string;

  @IsString()
  event_type: string;

  @IsOptional()
  @IsInt()
  product_id?: number;

  @IsOptional()
  @IsInt()
  category_id?: number;

  @IsOptional()
  @IsString()
  search_query?: string;

  @IsOptional()
  @IsString()
  recommendation_type?: string;

  @IsOptional()
  @IsInt()
  recommendation_position?: number;

  @IsOptional()
  @IsString()
  recommendation_source?: string;

  @IsOptional()
  @IsObject()
  event_data?: Record<string, any>;
}

export class BatchTrackDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrackEventDto)
  events: TrackEventDto[];
}

export class AnalyticsPeriodDto {
  @IsOptional()
  @IsString()
  period?: string = '7d';

  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 10;
}
