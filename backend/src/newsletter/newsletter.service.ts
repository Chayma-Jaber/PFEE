import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';
import { SubscribeDto, UnsubscribeDto, UpdatePreferencesDto } from './dto/newsletter.dto';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectRepository(NewsletterSubscriber)
    private readonly subscriberRepo: Repository<NewsletterSubscriber>,
  ) {}

  async subscribe(dto: SubscribeDto) {
    const existing = await this.subscriberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      if (existing.unsubscribed_at) {
        // Re-subscribe
        existing.unsubscribed_at = null;
        existing.unsubscribe_reason = null;
        existing.subscribed_at = new Date();
        existing.is_confirmed = false;
        existing.confirmation_token = randomBytes(32).toString('hex');
        existing.first_name = dto.first_name || existing.first_name;
        existing.preferences = dto.preferences
          ? {
              promotions: dto.preferences.promotions ?? true,
              new_arrivals: dto.preferences.new_arrivals ?? true,
              style_tips: dto.preferences.style_tips ?? true,
            }
          : existing.preferences;
        existing.source = dto.source || existing.source;

        await this.subscriberRepo.save(existing);
        return {
          success: true,
          message: 'Welcome back! Please confirm your subscription.',
          requires_confirmation: true,
        };
      }

      throw new ConflictException('This email is already subscribed');
    }

    const confirmationToken = randomBytes(32).toString('hex');

    const subscriber = this.subscriberRepo.create({
      email: dto.email.toLowerCase(),
      first_name: dto.first_name || null,
      preferences: {
        promotions: dto.preferences?.promotions ?? true,
        new_arrivals: dto.preferences?.new_arrivals ?? true,
        style_tips: dto.preferences?.style_tips ?? true,
      },
      source: dto.source || null,
      is_confirmed: false,
      confirmation_token: confirmationToken,
      subscribed_at: new Date(),
    });

    await this.subscriberRepo.save(subscriber);

    return {
      success: true,
      message: 'Subscription successful! Please check your email to confirm.',
      requires_confirmation: true,
    };
  }

  async confirmSubscription(token: string) {
    const subscriber = await this.subscriberRepo.findOne({
      where: { confirmation_token: token },
    });

    if (!subscriber) {
      throw new NotFoundException('Invalid or expired confirmation token');
    }

    if (subscriber.is_confirmed) {
      return { message: 'Subscription already confirmed' };
    }

    subscriber.is_confirmed = true;
    subscriber.confirmed_at = new Date();
    subscriber.confirmation_token = null;

    await this.subscriberRepo.save(subscriber);

    return { message: 'Subscription confirmed successfully' };
  }

  async unsubscribe(dto: UnsubscribeDto) {
    const subscriber = await this.subscriberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!subscriber) {
      throw new NotFoundException('Email not found in subscribers list');
    }

    if (subscriber.unsubscribed_at) {
      throw new BadRequestException('Already unsubscribed');
    }

    subscriber.unsubscribed_at = new Date();
    subscriber.unsubscribe_reason = dto.reason || null;

    await this.subscriberRepo.save(subscriber);

    return { message: 'Successfully unsubscribed' };
  }

  async updatePreferences(dto: UpdatePreferencesDto) {
    const subscriber = await this.subscriberRepo.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (!subscriber) {
      throw new NotFoundException('Email not found in subscribers list');
    }

    if (subscriber.unsubscribed_at) {
      throw new BadRequestException('Cannot update preferences for an unsubscribed email');
    }

    subscriber.preferences = {
      promotions: dto.preferences.promotions ?? subscriber.preferences?.promotions ?? true,
      new_arrivals: dto.preferences.new_arrivals ?? subscriber.preferences?.new_arrivals ?? true,
      style_tips: dto.preferences.style_tips ?? subscriber.preferences?.style_tips ?? true,
    };

    await this.subscriberRepo.save(subscriber);

    return {
      message: 'Preferences updated successfully',
      preferences: subscriber.preferences,
    };
  }

  async getStatus(email: string) {
    const subscriber = await this.subscriberRepo.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!subscriber) {
      return {
        subscribed: false,
        confirmed: false,
        preferences: null,
      };
    }

    return {
      subscribed: !subscriber.unsubscribed_at,
      confirmed: subscriber.is_confirmed,
      preferences: subscriber.preferences,
      subscribed_at: subscriber.subscribed_at,
      confirmed_at: subscriber.confirmed_at,
      unsubscribed_at: subscriber.unsubscribed_at,
    };
  }
}
