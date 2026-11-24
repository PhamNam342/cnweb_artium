import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToMany,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import type { SellerWebsite } from './seller-website.entity';

export enum SellerProfileType {
  Individual = 'individual',
  Gallery = 'gallery',
  Institution = 'institution',
}

export enum SellerVerificationStatus {
  Unverified = 'unverified',
  Pending = 'pending',
  Verified = 'verified',
  Rejected = 'rejected',
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  tiktok?: string;
  website?: string;
}

@Entity('seller_profiles')
@Index('idx_seller_profiles_verification', ['verificationStatus', 'isFeatured'])
export class SellerProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('uq_seller_profiles_user', { unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  /** 1-1 với users: đảm bảo bằng unique index uq_seller_profiles_user. */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_seller_profiles_user',
  })
  user?: User;

  @Index('uq_seller_profiles_slug', { unique: true })
  @Column({ type: 'varchar', length: 120 })
  slug!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 255 })
  displayName!: string;

  @Column({
    name: 'profile_type',
    type: 'enum',
    enum: SellerProfileType,
    enumName: 'seller_profile_type',
    default: SellerProfileType.Individual,
  })
  profileType!: SellerProfileType;

  @Column({ type: 'text', nullable: true })
  bio!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({
    name: 'cover_image_url',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  coverImageUrl!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location!: string | null;

  @Column({ name: 'social_links', type: 'jsonb', default: () => "'{}'" })
  socialLinks!: SocialLinks;

  @Column({ name: 'tax_code', type: 'varchar', length: 32, nullable: true })
  taxCode!: string | null;

  @Column({ name: 'business_address', type: 'jsonb', nullable: true })
  businessAddress!: Record<string, string> | null;

  @Column({
    name: 'verification_status',
    type: 'enum',
    enum: SellerVerificationStatus,
    enumName: 'seller_verification_status',
    default: SellerVerificationStatus.Unverified,
  })
  verificationStatus!: SellerVerificationStatus;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: 'is_featured', type: 'boolean', default: false })
  isFeatured!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @OneToMany('SellerWebsite', (w: SellerWebsite) => w.sellerProfile)
  websites?: SellerWebsite[];
}
