import { SellerProfile, SocialLinks } from './entities/seller-profile.entity';

export class SellerWebsiteResponse {
  id!: string;
  type!: string;
  title!: string;
  url!: string;
  displayOrder!: number;
  isVisible!: boolean;
}

export class SellerProfileResponse {
  id!: string;
  userId!: string;
  slug!: string;
  displayName!: string;
  profileType!: string;
  bio!: string | null;
  avatarUrl!: string | null;
  coverImageUrl!: string | null;
  location!: string | null;
  socialLinks!: SocialLinks;
  verificationStatus!: string;
  verifiedAt!: Date | null;
  isFeatured!: boolean;
  websites!: SellerWebsiteResponse[];
  createdAt!: Date;
  /** Chỉ có khi chủ hồ sơ xem. */
  taxCode?: string | null;
  businessAddress?: Record<string, string> | null;
}

export function toSellerResponse(
  p: SellerProfile,
  isOwner: boolean,
): SellerProfileResponse {
  const websites = (p.websites ?? [])
    .filter((w) => isOwner || w.isVisible)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((w) => ({
      id: w.id,
      type: w.type,
      title: w.title,
      url: w.url,
      displayOrder: w.displayOrder,
      isVisible: w.isVisible,
    }));
  return {
    id: p.id,
    userId: p.userId,
    slug: p.slug,
    displayName: p.displayName,
    profileType: p.profileType,
    bio: p.bio,
    avatarUrl: p.avatarUrl,
    coverImageUrl: p.coverImageUrl,
    location: p.location,
    socialLinks: p.socialLinks,
    verificationStatus: p.verificationStatus,
    verifiedAt: p.verifiedAt,
    isFeatured: p.isFeatured,
    websites,
    createdAt: p.createdAt,
    ...(isOwner
      ? { taxCode: p.taxCode, businessAddress: p.businessAddress }
      : {}),
  };
}
