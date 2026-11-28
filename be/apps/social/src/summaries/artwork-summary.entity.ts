import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * PROJECTION từ catalog (event catalog.artwork.*).
 * Social dùng để biết tác phẩm có tồn tại, của ai, đang công khai không — mà không gọi sang catalog.
 * Tác phẩm bị gỡ / xóa: giữ dòng, is_public = false (like / bình luận cũ vẫn trỏ vào).
 */
@Entity('artwork_summaries')
@Index('idx_artwork_summaries_seller', ['sellerId'], { where: '"is_public"' })
export class ArtworkSummary {
  @PrimaryColumn({ name: 'artwork_id', type: 'uuid' })
  artworkId!: string;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId!: string;

  @Column({ type: 'varchar', length: 100 })
  title!: string;

  @Column({
    name: 'cover_image_url',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  coverImageUrl!: string | null;

  /** status published | sold_out */
  @Column({ name: 'is_public', type: 'boolean' })
  isPublic!: boolean;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
