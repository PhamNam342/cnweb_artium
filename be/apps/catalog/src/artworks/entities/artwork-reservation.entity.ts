import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Artwork } from './artwork.entity';

export enum ReservationStatus {
  Active = 'active',
  Confirmed = 'confirmed',
  Released = 'released',
}

/** Giữ hàng khi checkout (commerce sẽ dùng qua event). */
@Entity('artwork_reservations')
@Unique('uq_artwork_reservations_order_artwork', ['orderId', 'artworkId'])
@Index('idx_artwork_reservations_status_expires', ['status', 'expiresAt'])
export class ArtworkReservation {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artwork_id', type: 'uuid' })
  artworkId!: string;

  @ManyToOne(() => Artwork, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'artwork_id',
    foreignKeyConstraintName: 'fk_artwork_reservations_artwork',
  })
  artwork?: Artwork;

  /** REF commerce.orders */
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @Column({ type: 'int', default: 1 })
  quantity!: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    enumName: 'reservation_status',
    default: ReservationStatus.Active,
  })
  status!: ReservationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
