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
  roles: string[];
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

export interface SellerProfileUpsertedPayload {
  sellerId: string;
  profileId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}
