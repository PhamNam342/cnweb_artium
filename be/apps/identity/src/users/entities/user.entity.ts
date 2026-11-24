import { UserRole } from '@app/common';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { SellerProfile } from '../../sellers/entities/seller-profile.entity';
import type { OAuthAccount } from './oauth-account.entity';

export enum UserStatus {
  Active = 'active',
  Suspended = 'suspended',
}

@Entity('users')
@Index('idx_users_status_created', ['status', 'createdAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Luôn lưu lowercase. */
  @Index('uq_users_email', { unique: true })
  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash!: string | null;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 1024, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string | null;

  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    array: true,
    default: [UserRole.Collector],
  })
  roles!: UserRole[];

  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.Active,
  })
  status!: UserStatus;

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city!: string | null;

  /** Slug thể loại quan tâm, VD: ['son-dau', 'nhiep-anh']. */
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  interests!: string[];

  /** NULL = chưa qua popup chọn vai trò lần đầu. */
  @Column({
    name: 'onboarding_completed_at',
    type: 'timestamptz',
    nullable: true,
  })
  onboardingCompletedAt!: Date | null;

  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt!: Date | null;

  @OneToMany('OAuthAccount', (a: OAuthAccount) => a.user)
  oauthAccounts?: OAuthAccount[];

  /** Không phải relation TypeORM (FK nằm ở seller_profiles); nạp bằng leftJoinAndMapOne. */
  sellerProfile?: SellerProfile | null;
}
