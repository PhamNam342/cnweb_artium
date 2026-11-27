export type UserRole = 'collector' | 'seller' | 'admin';

/** Khớp với UserResponse của identity service. */
export interface User {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  phone: string | null;
  /** Mỗi tài khoản một vai trò */
  role: UserRole;
  status: string;
  emailVerified: boolean;
  city: string | null;
  interests: string[];
  onboardingCompleted: boolean;
  hasPassword: boolean;
  linkedProviders: string[];
  sellerSlug: string | null;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
  user: User;
}

export type SellerProfileType = 'individual' | 'gallery' | 'institution';

export interface SellerWebsiteInput {
  type?: string;
  title: string;
  url: string;
}

export interface OnboardingPayload {
  role: 'collector' | 'artist';
  fullName: string;
  phone?: string;
  city?: string;
  interests?: string[];
  seller?: {
    displayName: string;
    slug?: string;
    profileType: SellerProfileType;
    bio?: string;
    location?: string;
    taxCode?: string;
    businessAddress?: Record<string, string>;
    socialLinks?: Partial<Record<'instagram' | 'facebook' | 'tiktok' | 'website', string>>;
  };
  websites?: SellerWebsiteInput[];
}

export interface OnboardingResponse {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface SlugAvailability {
  slug: string;
  available: boolean;
  reason?: string;
}
