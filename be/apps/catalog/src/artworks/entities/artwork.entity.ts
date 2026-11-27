import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { numericTransformer } from '../../common/numeric.transformer';
import { ArtworkFolder } from '../../folders/artwork-folder.entity';
import type { ArtworkTag } from '../../tags/entities/artwork-tag.entity';
import type { ArtworkImage } from './artwork-image.entity';
import {
  ArtworkSaleRecord,
  ArtworkShipping,
  ArtworkStatus,
  DimensionUnit,
  ListingType,
  WeightUnit,
} from './artwork.enums';

const cm = {
  type: 'numeric' as const,
  precision: 8,
  scale: 2,
  nullable: true,
  transformer: numericTransformer,
};

@Entity('artworks')
@Check(
  'chk_artworks_quantity',
  'quantity_available >= 0 AND quantity_available <= quantity_total',
)
@Check('chk_artworks_price', 'price IS NULL OR price > 0')
@Index('idx_artworks_seller_status_created', [
  'sellerId',
  'status',
  'createdAt',
])
@Index('idx_artworks_status_published', ['status', 'publishedAt'])
@Index('idx_artworks_folder', ['folderId'])
export class Artwork {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** REF identity.users — không có FK vật lý. */
  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId!: string;

  @Column({ name: 'folder_id', type: 'uuid', nullable: true })
  folderId!: string | null;

  @ManyToOne(() => ArtworkFolder, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({
    name: 'folder_id',
    foreignKeyConstraintName: 'fk_artworks_folder',
  })
  folder?: ArtworkFolder | null;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({ type: 'varchar', length: 350, nullable: true })
  description!: string | null;

  @Column({
    name: 'creator_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  creatorName!: string | null;

  @Column({ name: 'creation_year', type: 'smallint', nullable: true })
  creationYear!: number | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  edition!: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  medium!: string | null;

  @Column({ name: 'width_cm', ...cm })
  widthCm!: number | null;

  @Column({ name: 'height_cm', ...cm })
  heightCm!: number | null;

  @Column({ name: 'depth_cm', ...cm })
  depthCm!: number | null;

  @Column({
    name: 'dimension_unit',
    type: 'enum',
    enum: DimensionUnit,
    enumName: 'dimension_unit',
    default: DimensionUnit.Cm,
  })
  dimensionUnit!: DimensionUnit;

  @Column({ name: 'weight_kg', ...cm })
  weightKg!: number | null;

  @Column({
    name: 'weight_unit',
    type: 'enum',
    enum: WeightUnit,
    enumName: 'weight_unit',
    default: WeightUnit.Kg,
  })
  weightUnit!: WeightUnit;

  @Column({ name: 'is_framed', type: 'boolean', default: false })
  isFramed!: boolean;

  @Column({
    name: 'listing_type',
    type: 'enum',
    enum: ListingType,
    enumName: 'listing_type',
    default: ListingType.ForSale,
  })
  listingType!: ListingType;

  /** VND (đồng). bigint => pg trả string, chuyển về number (an toàn tới 9e15). */
  @Column({ type: 'bigint', nullable: true, transformer: numericTransformer })
  price!: number | null;

  @Column({ name: 'quantity_total', type: 'int', default: 1 })
  quantityTotal!: number;

  @Column({ name: 'quantity_available', type: 'int', default: 1 })
  quantityAvailable!: number;

  @Column({ name: 'allow_offers', type: 'boolean', default: false })
  allowOffers!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  shipping!: ArtworkShipping | null;

  @Column({ name: 'sale_record', type: 'jsonb', nullable: true })
  saleRecord!: ArtworkSaleRecord | null;

  @Column({
    type: 'enum',
    enum: ArtworkStatus,
    enumName: 'artwork_status',
    default: ArtworkStatus.Draft,
  })
  status!: ArtworkStatus;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount!: number;

  @Column({ name: 'like_count', type: 'int', default: 0 })
  likeCount!: number;

  @Column({ name: 'comment_count', type: 'int', default: 0 })
  commentCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany('ArtworkImage', (i: ArtworkImage) => i.artwork)
  images?: ArtworkImage[];

  @OneToMany('ArtworkTag', (t: ArtworkTag) => t.artwork)
  artworkTags?: ArtworkTag[];
}
