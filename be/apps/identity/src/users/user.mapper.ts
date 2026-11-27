import { ApiProperty } from '@nestjs/swagger';
import { User } from './entities/user.entity';

export class UserResponse {
  id!: string;
  email!: string;
  fullName!: string;
  avatarUrl!: string | null;
  phone!: string | null;
  @ApiProperty({ enum: ['collector', 'seller', 'admin'], isArray: true })
  role!: string;
  status!: string;
  emailVerified!: boolean;
  city!: string | null;
  interests!: string[];
  /** false => FE hiện popup onboarding (không đóng được). */
  onboardingCompleted!: boolean;
  hasPassword!: boolean;
  /** Các provider OAuth đã liên kết, VD: ['google'] */
  linkedProviders!: string[];
  sellerSlug!: string | null;
  createdAt!: Date;
}

export class PublicUserResponse {
  id!: string;
  fullName!: string;
  avatarUrl!: string | null;
  sellerSlug!: string | null;
}

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerifiedAt !== null,
    city: user.city,
    interests: user.interests,
    onboardingCompleted: user.onboardingCompletedAt !== null,
    hasPassword: Boolean(user.passwordHash),
    linkedProviders: user.oauthAccounts?.map((a) => a.provider) ?? [],
    sellerSlug: user.sellerProfile?.slug ?? null,
    createdAt: user.createdAt,
  };
}

export function toPublicUserResponse(user: User): PublicUserResponse {
  return {
    id: user.id,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    sellerSlug: user.sellerProfile?.slug ?? null,
  };
}
