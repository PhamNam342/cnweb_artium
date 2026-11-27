import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum TagCategory {
  Medium = 'medium',
  Style = 'style',
  Subject = 'subject',
  Other = 'other',
}

@Entity('tags')
/** Unique (seller_id, slug) NULLS NOT DISTINCT — tạo trong migration (TypeORM không biểu diễn được). */
@Index('uq_tags_seller_slug', { synchronize: false })
@Index('idx_tags_category', ['category'])
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** NULL = tag hệ thống. */
  @Column({ name: 'seller_id', type: 'uuid', nullable: true })
  sellerId!: string | null;

  @Column({
    type: 'enum',
    enum: TagCategory,
    enumName: 'tag_category',
    default: TagCategory.Other,
  })
  category!: TagCategory;

  @Column({ type: 'varchar', length: 64 })
  name!: string;

  @Column({ type: 'varchar', length: 80 })
  slug!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
