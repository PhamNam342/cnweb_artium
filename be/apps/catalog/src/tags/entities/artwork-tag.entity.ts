import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Artwork } from '../../artworks/entities/artwork.entity';
import { Tag } from './tag.entity';

@Entity('artwork_tags')
@Index('idx_artwork_tags_tag', ['tagId'])
export class ArtworkTag {
  @PrimaryColumn({ name: 'artwork_id', type: 'uuid' })
  artworkId!: string;

  @PrimaryColumn({ name: 'tag_id', type: 'uuid' })
  tagId!: string;

  @ManyToOne(() => Artwork, (a) => a.artworkTags, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'artwork_id',
    foreignKeyConstraintName: 'fk_artwork_tags_artwork',
  })
  artwork?: Artwork;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'tag_id',
    foreignKeyConstraintName: 'fk_artwork_tags_tag',
  })
  tag?: Tag;
}
