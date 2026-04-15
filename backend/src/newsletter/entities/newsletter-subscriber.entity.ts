import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export interface NewsletterPreferences {
  promotions: boolean;
  new_arrivals: boolean;
  style_tips: boolean;
}

export enum SubscriptionSource {
  FOOTER = 'footer',
  POPUP = 'popup',
  CHECKOUT = 'checkout',
  ACCOUNT = 'account',
}

@Entity('newsletter_subscribers')
export class NewsletterSubscriber {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ name: 'first_name', type: 'varchar', length: 100, nullable: true })
  first_name: string;

  @Column({ type: 'simple-json', nullable: true })
  preferences: NewsletterPreferences;

  @Column({ type: 'varchar', length: 20, nullable: true })
  source: SubscriptionSource;

  @Column({ name: 'is_confirmed', default: false })
  is_confirmed: boolean;

  @Column({ name: 'confirmation_token', type: 'varchar', length: 255, unique: true, nullable: true })
  confirmation_token: string | null;

  @Column({ name: 'unsubscribe_reason', type: 'nvarchar', length: 'MAX', nullable: true })
  unsubscribe_reason: string | null;

  @Column({ name: 'subscribed_at', type: 'datetime', nullable: true })
  subscribed_at: Date | null;

  @Column({ name: 'confirmed_at', type: 'datetime', nullable: true })
  confirmed_at: Date | null;

  @Column({ name: 'unsubscribed_at', type: 'datetime', nullable: true })
  unsubscribed_at: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
