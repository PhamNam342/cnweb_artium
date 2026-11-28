import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * PROJECTION từ identity (event identity.user.* và identity.seller_profile.upserted).
 * Chỉ đọc ở social: hiển thị tên / avatar trong bình luận, danh sách theo dõi, moment.
 */
@Entity('user_summaries')
export class UserSummary {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  /** NULL nếu không phải nghệ sĩ. */
  @Column({ name: 'seller_slug', type: 'varchar', length: 120, nullable: true })
  sellerSlug!: string | null;

  /** = occurredAt của event mới nhất đã áp dụng (chặn event đến trễ ghi đè). */
  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
