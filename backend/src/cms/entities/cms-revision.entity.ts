import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// One snapshot of a page at a given version. Lets editors revert.
@Entity('cms_revisions')
export class CmsRevision {
  @PrimaryGeneratedColumn() id: number;

  @Index()
  @Column({ name: 'page_id', type: 'int' })
  page_id: number;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'simple-json' })
  snapshot: Record<string, any>;

  @Column({ name: 'edited_by', type: 'int', nullable: true })
  edited_by: number | null;

  @Column({ name: 'change_note', type: 'nvarchar', length: 400, nullable: true })
  change_note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
