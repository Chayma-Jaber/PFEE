import {
  IsString,
  IsOptional,
  IsArray,
  IsNumber,
  ValidateNested,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant', 'system'] })
  @IsString()
  role: 'user' | 'assistant' | 'system';

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  content: string;
}

export class UserContextDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  current_page?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  user_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  cart_items?: any[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  recent_views?: number[];
}

export class ChatRequestDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages: ChatMessageDto[];

  @ApiPropertyOptional({ type: UserContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UserContextDto)
  user_context?: UserContextDto;

  @ApiPropertyOptional({ description: 'Optional model override' })
  @IsOptional()
  @IsString()
  model?: string;
}

export class ChatResponseDto {
  @ApiProperty({ description: 'AI response text' })
  text: string;

  @ApiPropertyOptional({ type: [Object], description: 'Matched products from catalog' })
  products?: any[];
}

export class VisualSearchRequestDto {
  @ApiPropertyOptional({ description: 'Base64-encoded image data' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ description: 'Base64-encoded image data (alias for image)' })
  @IsOptional()
  @IsString()
  image_base64?: string;

  @ApiPropertyOptional({ description: 'Maximum number of results' })
  @IsOptional()
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ description: 'Image URL (alternative to base64)' })
  @IsOptional()
  @IsString()
  image_url?: string;
}

export class VisualSearchResultDto {
  @ApiProperty()
  product_id: number;

  @ApiProperty()
  similarity: number;
}

export class VisualSearchResponseDto {
  @ApiProperty({ type: [VisualSearchResultDto] })
  results: VisualSearchResultDto[];

  @ApiPropertyOptional()
  query_description?: string;
}
