import {
  EmailVerificationRequestedPayload,
  IdentityEvents,
  PasswordChangeCodeRequestedPayload,
  PasswordResetRequestedPayload,
  SellerProfileUpsertedPayload,
  UserRegisteredPayload,
  UserUpdatedPayload,
} from '@app/contracts';
import { DomainEvent } from '@app/database';
import {
  SellerProfile,
  SellerVerificationStatus,
} from './sellers/entities/seller-profile.entity';
import { User } from './users/entities/user.entity';

/** Các hàm dựng event của identity — một chỗ duy nhất để payload luôn khớp contracts. */
export const identityEvents = {
  userRegistered: (
    user: User,
    provider: UserRegisteredPayload['provider'],
  ): DomainEvent<UserRegisteredPayload> => ({
    aggregateType: 'User',
    aggregateId: user.id,
    type: IdentityEvents.UserRegistered,
    payload: {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      provider,
    },
  }),

  userUpdated: (user: User): DomainEvent<UserUpdatedPayload> => ({
    aggregateType: 'User',
    aggregateId: user.id,
    type: IdentityEvents.UserUpdated,
    payload: {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: user.role,
      status: user.status,
    },
  }),

  emailVerificationRequested: (
    user: User,
    verifyUrl: string,
    expiresAt: Date,
  ): DomainEvent<EmailVerificationRequestedPayload> => ({
    aggregateType: 'User',
    aggregateId: user.id,
    type: IdentityEvents.EmailVerificationRequested,
    payload: {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      verifyUrl,
      expiresAt: expiresAt.toISOString(),
    },
  }),

  passwordResetRequested: (
    user: User,
    resetUrl: string,
    expiresAt: Date,
  ): DomainEvent<PasswordResetRequestedPayload> => ({
    aggregateType: 'User',
    aggregateId: user.id,
    type: IdentityEvents.PasswordResetRequested,
    payload: {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      resetUrl,
      expiresAt: expiresAt.toISOString(),
    },
  }),

  passwordChangeCodeRequested: (
    user: User,
    code: string,
    expiresAt: Date,
  ): DomainEvent<PasswordChangeCodeRequestedPayload> => ({
    aggregateType: 'User',
    aggregateId: user.id,
    type: IdentityEvents.PasswordChangeCodeRequested,
    payload: {
      userId: user.id,
      email: user.email,
      fullName: user.fullName,
      code,
      expiresAt: expiresAt.toISOString(),
    },
  }),

  sellerProfileUpserted: (
    profile: SellerProfile,
  ): DomainEvent<SellerProfileUpsertedPayload> => ({
    aggregateType: 'SellerProfile',
    aggregateId: profile.id,
    type: IdentityEvents.SellerProfileUpserted,
    payload: {
      sellerId: profile.userId,
      profileId: profile.id,
      slug: profile.slug,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      isVerified:
        profile.verificationStatus === SellerVerificationStatus.Verified,
    },
  }),
};
