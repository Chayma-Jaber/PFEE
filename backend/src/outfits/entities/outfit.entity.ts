import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('outfits')
export class Outfit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'nvarchar', length: 'MAX', nullable: true })
  description: string;

  @Column({ name: 'image_url', nullable: true })
  image_url: string;

  @Column({ name: 'style_tags', type: 'simple-json', nullable: true })
  style_tags: string[];

  @Column({ nullable: true })
  occasion: string;

  @Column({ type: 'simple-json', nullable: true })
  products: number[];

  @Column({
    name: 'total_price',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  total_price: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  savings: number;

  @Column({ name: 'is_published', default: false })
  is_published: boolean;

  @Column({ name: 'created_by', nullable: true })
  created_by: number;

  @Column({ name: 'view_count', default: 0 })
  view_count: number;

  @Column({ name: 'like_count', default: 0 })
  like_count: number;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
