import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SubscriptionSource } from '../entities/newsletter-subscriber.entity';

export class NewsletterPreferencesDto {
  @IsOptional()
  @IsBoolean()
  promotions?: boolean;

  @IsOptional()
  @IsBoolean()
  new_arrivals?: boolean;

  @IsOptional()
  @IsBoolean()
  style_tips?: boolean;
}

export class SubscribeDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string;

  @IsOptional()
  @IsObject()
  @Type(() => NewsletterPreferencesDto)
  preferences?: NewsletterPreferencesDto;

  @IsOptional()
  @IsEnum(SubscriptionSource)
  source?: SubscriptionSource;
}

export class UnsubscribeDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class UpdatePreferencesDto {
  @IsEmail()
  email: string;

  @IsObject()
  @Type(() => NewsletterPreferencesDto)
  preferences: NewsletterPreferencesDto;
}
