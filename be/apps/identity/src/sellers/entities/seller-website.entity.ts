import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SellerProfile } from './seller-profile.entity';

@Entity('seller_websites')
@Index('idx_seller_websites_profile_order', ['sellerProfileId', 'displayOrder'])
export class SellerWebsite {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'seller_profile_id', type: 'uuid' })
  sellerProfileId!: string;

  @ManyToOne(() => SellerProfile, (p) => p.websites, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'seller_profile_id',
    foreignKeyConstraintName: 'fk_seller_websites_profile',
  })
  sellerProfile?: SellerProfile;

  @Column({ type: 'varchar', length: 32, default: 'portfolio' })
  type!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'varchar', length: 1024 })
  url!: string;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder!: number;

  @Column({ name: 'is_visible', type: 'boolean', default: true })
  isVisible!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
