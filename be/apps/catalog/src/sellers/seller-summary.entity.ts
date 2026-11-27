import { Column, Entity, PrimaryColumn } from 'typeorm';

/** PROJECTION từ identity (event identity.seller_profile.upserted). Chỉ đọc ở catalog. */
@Entity('seller_summaries')
export class SellerSummary {
  @PrimaryColumn({ name: 'seller_id', type: 'uuid' })
  sellerId!: string;

  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'is_verified', type: 'boolean', default: false })
  isVerified!: boolean;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
