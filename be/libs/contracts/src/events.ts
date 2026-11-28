/**
 * Hợp đồng event giữa các service. Routing key = tên event.
 * Danh sách đầy đủ: docs/database/schema-entities.md (mục "Event giữa các service").
 */
export const EVENTS_EXCHANGE = 'artium.events';

export interface EventEnvelope<T = unknown> {
  /** = outbox.id của service phát; consumer dùng làm khóa idempotency (inbox). */
  id: string;
  type: string;
  source: string;
  occurredAt: string;
  payload: T;
}

export const IdentityEvents = {
  UserRegistered: 'identity.user.registered',
  UserUpdated: 'identity.user.updated',
  EmailVerificationRequested: 'identity.email_verification.requested',
  PasswordResetRequested: 'identity.password_reset.requested',
  /** Mã 6 số để đổi mật khẩu khi đang đăng nhập (gửi qua email). */
  PasswordChangeCodeRequested: 'identity.password_change.requested',
  SellerProfileUpserted: 'identity.seller_profile.upserted',
} as const;

export interface UserRegisteredPayload {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  provider: 'password' | 'google';
}

export interface UserUpdatedPayload {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: string;
  status: string;
}

export interface EmailVerificationRequestedPayload {
  userId: string;
  email: string;
  fullName: string;
  verifyUrl: string;
  expiresAt: string;
}

export interface PasswordResetRequestedPayload {
  userId: string;
  email: string;
  fullName: string;
  resetUrl: string;
  expiresAt: string;
}

export interface PasswordChangeCodeRequestedPayload {
  userId: string;
  email: string;
  fullName: string;
  /** Mã 6 chữ số (chỉ để gửi mail; DB chỉ lưu bản băm) */
  code: string;
  expiresAt: string;
}

export interface SellerProfileUpsertedPayload {
  sellerId: string;
  profileId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export const CatalogEvents = {
  ArtworkPublished: 'catalog.artwork.published',
  ArtworkUpdated: 'catalog.artwork.updated',
  /** Gỡ khỏi công khai: unpublish, lưu trữ hoặc xóa (xem field reason). */
  ArtworkArchived: 'catalog.artwork.archived',
} as const;

/** Snapshot tác phẩm gửi kèm event catalog — đủ để service khác hiển thị mà không gọi lại. */
export interface ArtworkSnapshotPayload {
  artworkId: string;
  sellerId: string;
  title: string;
  coverImageUrl: string | null;
  listingType: string;
  status: string;
  price: number | null;
  quantityAvailable: number;
  reason?: 'unpublished' | 'archived' | 'deleted';
}

export const SocialEvents = {
  /** Số like của một đối tượng vừa đổi (issue 01). */
  ReactionChanged: 'social.reaction.changed',
  /** Số bình luận của một đối tượng vừa đổi (issue 02). */
  CommentChanged: 'social.comment.changed',
} as const;

/**
 * Mang SỐ ĐẾM MỚI NHẤT (không phải +1 / -1): consumer nhận trùng hoặc sai thứ tự vẫn ra đúng.
 * Catalog dùng để cập nhật artworks.like_count / comment_count.
 */
export interface SocialCountChangedPayload {
  targetType: 'artwork' | 'moment' | 'comment' | 'moodboard' | 'review';
  targetId: string;
  targetOwnerId: string;
  count: number;
}
