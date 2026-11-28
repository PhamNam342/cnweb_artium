import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ArtworkSummary } from '../summaries/artwork-summary.entity';
import { SocialTargetType } from './social-target-type';
import { TargetInfo, TargetRegistry, TargetResolver } from './target-registry';

/**
 * Tác phẩm: đọc projection artwork_summaries.
 * Không có setCount: like_count / comment_count nằm ở catalog, cập nhật qua event social.*.changed.
 */
@Injectable()
export class ArtworkTargetResolver implements TargetResolver, OnModuleInit {
  readonly type = SocialTargetType.Artwork;

  constructor(private readonly registry: TargetRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
  }

  async resolve(m: EntityManager, id: string): Promise<TargetInfo | null> {
    const a = await m.findOne(ArtworkSummary, { where: { artworkId: id } });
    return a ? { ownerId: a.sellerId, visible: a.isPublic } : null;
  }
}
