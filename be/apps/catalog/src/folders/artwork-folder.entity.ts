import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('artwork_folders')
@Index('idx_artwork_folders_seller_parent_position', [
  'sellerId',
  'parentId',
  'position',
])
export class ArtworkFolder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId!: string;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId!: string | null;

  @ManyToOne(() => ArtworkFolder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'parent_id',
    foreignKeyConstraintName: 'fk_artwork_folders_parent',
  })
  parent?: ArtworkFolder | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ name: 'is_hidden', type: 'boolean', default: false })
  isHidden!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
