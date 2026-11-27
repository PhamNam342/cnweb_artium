import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Artwork } from './artwork.entity';

@Entity('artwork_images')
@Index('idx_artwork_images_artwork_position', ['artworkId', 'position'])
export class ArtworkImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artwork_id', type: 'uuid' })
  artworkId!: string;

  @ManyToOne(() => Artwork, (a) => a.images, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'artwork_id',
    foreignKeyConstraintName: 'fk_artwork_images_artwork',
  })
  artwork?: Artwork;

  @Index('uq_artwork_images_public_id', { unique: true })
  @Column({ name: 'public_id', type: 'varchar', length: 255 })
  publicId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'varchar', length: 10 })
  format!: string;

  @Column({ type: 'int' })
  width!: number;

  @Column({ type: 'int' })
  height!: number;

  @Column({ type: 'int' })
  bytes!: number;

  /** 0 = ảnh bìa */
  @Column({ type: 'smallint', default: 0 })
  position!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
