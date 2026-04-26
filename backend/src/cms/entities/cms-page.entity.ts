import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum CmsPageStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SCHEDULED = 'SCHEDULED',
  ARCHIVED = 'ARCHIVED',
}

// A storefront page composed of a tree of "blocks". Blocks are content-typed JSON,
// rendered by Angular components (HeroBlock, GridBlock, BannerBlock, etc.).
@Entity('cms_pages')
export class CmsPage {
  @PrimaryGeneratedColumn() id: number;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200 })
  slug: string;

  @Column({ type: 'nvarchar', length: 250 })
  title: string;

  @Column({ name: 'meta_description', type: 'nvarchar', length: 400, nullable: true })
  meta_description: string | null;

  @Column({ name: 'cover_image', type: 'varchar', length: 500, nullable: true })
  cover_image: string | null;

  // Locale: fr | ar | en
  @Index()
  @Column({ type: 'varchar', length: 5, default: 'fr' })
  locale: string;

  // The visual tree.
  // Each block: { type: 'hero' | 'grid' | 'banner' | 'text' | 'product-list' | ..., props: {...} }
  @Column({ type: 'simple-json' })
  blocks: Array<{ type: string; props: Record<string, any> }>;

  @Index()
  @Column({ type: 'varchar', length: 20, default: CmsPageStatus.DRAFT })
  status: CmsPageStatus;

  @Column({ name: 'publish_at', type: 'datetime', nullable: true })
  publish_at: Date | null;

  @Column({ name: 'unpublish_at', type: 'datetime', nullable: true })
  unpublish_at: Date | null;

  // Increments on every edit so callers can cache safely
  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  created_by: number | null;

  @Column({ name: 'updated_by', type: 'int', nullable: true })
  updated_by: number | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;
}
