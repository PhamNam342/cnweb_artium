import { AuthUser, slugify, UserRole } from '@app/common';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TagResponse } from '../artworks/artwork.mapper';
import { CreateTagDto, TagQueryDto } from './dto/tag.dto';
import { Tag, TagCategory } from './entities/tag.entity';

export const MAX_SELLER_TAGS = 100;

const toResponse = (t: Tag): TagResponse => ({
  id: t.id,
  name: t.name,
  slug: t.slug,
  category: t.category,
  isSystem: t.sellerId === null,
});

@Injectable()
export class TagsService {
  constructor(@InjectRepository(Tag) private readonly tags: Repository<Tag>) {}

  async list(q: TagQueryDto, user?: AuthUser): Promise<TagResponse[]> {
    const sellerId = user?.role === UserRole.Seller ? user.id : null;
    const qb = this.tags.createQueryBuilder('t');
    if (q.scope === 'system' || !sellerId) qb.where('t.seller_id IS NULL');
    else if (q.scope === 'mine')
      qb.where('t.seller_id = :sid', { sid: sellerId });
    else
      qb.where('(t.seller_id IS NULL OR t.seller_id = :sid)', {
        sid: sellerId,
      });
    if (q.category) qb.andWhere('t.category = :c', { c: q.category });
    const rows = await qb
      .orderBy('t.category')
      .addOrderBy('t.seller_id', 'ASC', 'NULLS FIRST')
      .addOrderBy('t.name')
      .getMany();
    return rows.map(toResponse);
  }

  /**
   * Tạo tag riêng của seller. Idempotent: trùng slug với tag hệ thống hoặc tag sẵn có của seller
   * thì trả về tag đó (FE gõ "Sơn dầu" sẽ nhận lại tag hệ thống son-dau).
   */
  async create(user: AuthUser, dto: CreateTagDto): Promise<TagResponse> {
    const slug = slugify(dto.name, 80);
    if (slug.length < 2) throw new BadRequestException('Tên tag không hợp lệ');
    const existing = await this.tags
      .createQueryBuilder('t')
      .where('t.slug = :slug AND (t.seller_id IS NULL OR t.seller_id = :sid)', {
        slug,
        sid: user.id,
      })
      .orderBy('t.seller_id', 'ASC', 'NULLS FIRST')
      .getOne();
    if (existing) return toResponse(existing);

    const count = await this.tags.count({ where: { sellerId: user.id } });
    if (count >= MAX_SELLER_TAGS)
      throw new BadRequestException(`Tối đa ${MAX_SELLER_TAGS} tag riêng`);
    await this.tags
      .createQueryBuilder()
      .insert()
      .into(Tag)
      .values({
        sellerId: user.id,
        name: dto.name,
        slug,
        category: dto.category ?? TagCategory.Other,
      })
      .orIgnore()
      .execute();
    const created = await this.tags.findOneByOrFail({
      sellerId: user.id,
      slug,
    });
    return toResponse(created);
  }
}
