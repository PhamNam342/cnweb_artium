import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export enum OAuthProvider {
  Google = 'google',
}

@Entity('oauth_accounts')
@Unique('uq_oauth_provider_user', ['provider', 'providerUserId'])
@Unique('uq_oauth_user_provider', ['userId', 'provider'])
export class OAuthAccount {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, (u) => u.oauthAccounts, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'fk_oauth_accounts_user',
  })
  user?: User;

  @Column({ type: 'enum', enum: OAuthProvider, enumName: 'oauth_provider' })
  provider!: OAuthProvider;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 255 })
  providerUserId!: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
