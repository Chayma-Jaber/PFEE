import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('banners')
export class Banner {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  subtitle: string;

  @Column({ name: 'image_url', type: 'varchar', length: 500 })
  image_url: string;

  @Column({ name: 'link_url', type: 'varchar', length: 500, nullable: true })
  link_url: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  position: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sort_order: number;

  @Column({ name: 'is_active', default: true })
  is_active: boolean;

  @Column({ name: 'start_date', type: 'datetime', nullable: true })
  start_date: Date;

  @Column({ name: 'end_date', type: 'datetime', nullable: true })
  end_date: Date;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
