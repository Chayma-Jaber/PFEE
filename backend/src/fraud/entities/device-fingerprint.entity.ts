import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('device_fingerprints')
export class DeviceFingerprint {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'fingerprint_hash', type: 'varchar', length: 64 })
  fingerprint_hash: string;

  @Index()
  @Column({ name: 'user_id', type: 'int', nullable: true })
  user_id: number | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ip_address: string | null;

  @Column({ name: 'user_agent', type: 'nvarchar', length: 500, nullable: true })
  user_agent: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 80, nullable: true })
  timezone: string | null;

  @Column({ name: 'screen_resolution', type: 'varchar', length: 30, nullable: true })
  screen_resolution: string | null;

  @Column({ name: 'session_count', type: 'int', default: 1 })
  session_count: number;

  @CreateDateColumn({ name: 'first_seen' })
  first_seen: Date;

  @UpdateDateColumn({ name: 'last_seen' })
  last_seen: Date;
}
