import { AuthUser, Page, toPage } from '@app/common';
import { ArtworkSnapshotPayload, CatalogEvents } from '@app/contracts';
import { DomainEvent, OutboxService } from '@app/database';
import { CloudinaryService } from '@app/storage';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  EntityManager,
  In,
  MoreThan,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { ArtworkFolder } from '../folders/artwork-folder.entity';
import { SellerSummary } from '../sellers/seller-summary.entity';
import { ArtworkTag } from '../tags/entities/artwork-tag.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ArtworkMapper, ArtworkResponse } from './artwork.mapper';
import {
  isPublic,
  PUBLIC_STATUSES,
  publishProblems,
  syncSoldOut,
} from './artwork-rules';
import {
  ArtworkSort,
  InventoryQueryDto,
  PublicArtworkQueryDto,
} from './dto/artwork-query.dto';
import {
  ArtworkImageInputDto,
  ArtworkInputDto,
  BulkAction,
  BulkArtworkDto,
  CreateArtworkDto,
  UpdateArtworkDto,
} from './dto/artwork.dto';
import { ArtworkImage } from './entities/artwork-image.entity';
import {
  ArtworkReservation,
  ReservationStatus,
} from './entities/artwork-reservation.entity';
import { Artwork } from './entities/artwork.entity';
import { ArtworkStatus, ListingType } from './entities/artwork.enums';

type ArchiveReason = NonNullable<ArtworkSnapshotPayload['reason']>;

/** Các field đơn giản copy thẳng từ DTO sang entity. */
const SCALAR_FIELDS = [
  'title',
  'description',
  'creatorName',
  'creationYear',
  'edition',
  'medium',
  'widthCm',
  'heightCm',
  'depthCm',
  'dimensionUnit',
  'weightKg',
  'weightUnit',
  'isFramed',
  'listingType',
  'price',
  'allowOffers',
  'shipping',
  'saleRecord',
] as const;

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

@Injectable()
export class ArtworksService {
  readonly mapper: ArtworkMapper;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Artwork) private readonly artworks: Repository<Artwork>,
    private readonly outbox: OutboxService,
    private readonly cloudinary: CloudinaryService,
  ) {
    this.mapper = new ArtworkMapper(cloudinary);
  }

  // ───────────────────────────── Seller: ghi ─────────────────────────────

  async create(
    user: AuthUser,
    dto: CreateArtworkDto,
  ): Promise<ArtworkResponse> {
    const id = await this.dataSource.transaction(async (m) => {
      const a = m.create(Artwork, {
        sellerId: user.id,
        status: ArtworkStatus.Draft,
        listingType: dto.listingType ?? ListingType.ForSale,
        quantityTotal: dto.quantityTotal ?? 1,
        quantityAvailable: dto.quantityTotal ?? 1,
      });
      this.applyFields(a, dto);
      // Mặc định tác giả là chính nghệ sĩ (gallery có thể ghi tên họa sĩ khác)
      if (!a.creatorName) {
        const seller = await m.findOne(SellerSummary, {
          where: { sellerId: user.id },
        });
        a.creatorName = seller?.displayName ?? null;
      }
      await this.assertFolder(m, user.id, dto.folderId);
      const saved = await m.save(a);
      if (dto.tagIds) await this.setTags(m, user.id, saved.id, dto.tagIds);
      if (dto.images?.length)
        await this.writeImages(m, user.id, saved.id, dto.images, []);
      return saved.id;
    });
    return this.getMine(user, id);
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateArtworkDto,
  ): Promise<ArtworkResponse> {
    await this.dataSource.transaction(async (m) => {
      const a = await this.lockOwned(m, user, id);
      if (a.status === ArtworkStatus.Archived) {
        throw new BadRequestException(
          'Tác phẩm đã lưu trữ — khôi phục trước khi sửa',
        );
      }
      const wasPublic = isPublic(a.status);

      this.applyFields(a, dto);
      if (dto.quantityTotal !== undefined)
        this.changeQuantity(a, dto.quantityTotal);
      if (dto.folderId !== undefined) {
        await this.assertFolder(m, user.id, dto.folderId);
        a.folderId = dto.folderId;
      }
      if (wasPublic) {
        const images = await m.count(ArtworkImage, {
          where: { artworkId: id },
        });
        this.assertPublishable(a, images);
        syncSoldOut(a);
      }
      await m.save(a);
      if (dto.tagIds) await this.setTags(m, user.id, id, dto.tagIds);
      if (wasPublic) await this.emit(m, a, CatalogEvents.ArtworkUpdated);
    });
    return this.getMine(user, id);
  }

  /**
   * Thay toàn bộ danh sách ảnh (thứ tự mảng = vị trí, phần tử đầu là ảnh bìa).
   * Ảnh đã có giữ nguyên theo publicId; ảnh mới phải kèm chữ ký Cloudinary.
   * Ảnh bị bỏ ra sẽ bị xóa khỏi Cloudinary sau khi commit.
   */
  async replaceImages(
    user: AuthUser,
    id: string,
    images: ArtworkImageInputDto[],
  ): Promise<ArtworkResponse> {
    const removed = await this.dataSource.transaction(async (m) => {
      const a = await this.lockOwned(m, user, id);
      if (isPublic(a.status) && images.length === 0) {
        throw new UnprocessableEntityException({
          message: 'Tác phẩm đang hiển thị cần ít nhất 1 ảnh',
          errors: ['Tác phẩm cần ít nhất 1 ảnh'],
        });
      }
      const existing = await m.find(ArtworkImage, { where: { artworkId: id } });
      const gone = await this.writeImages(m, user.id, id, images, existing);
      if (isPublic(a.status)) {
        a.updatedAt = new Date();
        await m.save(a);
        await this.emit(m, a, CatalogEvents.ArtworkUpdated);
      }
      return gone;
    });
    await this.cloudinary.destroy(removed);
    return this.getMine(user, id);
  }

  async publish(user: AuthUser, id: string): Promise<ArtworkResponse> {
    if (!user.emailVerified) {
      throw new ForbiddenException(
        'Cần xác minh email trước khi đăng tác phẩm',
      );
    }
    await this.dataSource.transaction(async (m) => {
      const a = await this.lockOwned(m, user, id);
      if (isPublic(a.status)) return;
      const images = await m.count(ArtworkImage, { where: { artworkId: id } });
      this.assertPublishable(a, images);
      a.status = ArtworkStatus.Published;
      a.publishedAt ??= new Date();
      syncSoldOut(a);
      await m.save(a);
      await this.emit(m, a, CatalogEvents.ArtworkPublished);
    });
    return this.getMine(user, id);
  }

  /** Gỡ khỏi công khai → bản nháp. */
  async unpublish(user: AuthUser, id: string): Promise<ArtworkResponse> {
    await this.dataSource.transaction((m) =>
      this.transition(m, user, id, ArtworkStatus.Draft, 'unpublished'),
    );
    return this.getMine(user, id);
  }

  async archive(user: AuthUser, id: string): Promise<ArtworkResponse> {
    await this.dataSource.transaction((m) =>
      this.transition(m, user, id, ArtworkStatus.Archived, 'archived'),
    );
    return this.getMine(user, id);
  }

  /** Khôi phục từ lưu trữ → bản nháp. */
  async restore(user: AuthUser, id: string): Promise<ArtworkResponse> {
    await this.dataSource.transaction(async (m) => {
      const a = await this.lockOwned(m, user, id);
      if (a.status !== ArtworkStatus.Archived) return;
      a.status = ArtworkStatus.Draft;
      await m.save(a);
    });
    return this.getMine(user, id);
  }

  /**
   * Xóa mềm (giữ lại để đối chiếu đơn hàng cũ). Tác phẩm đang có người giữ chỗ thanh toán
   * thì không xóa được — FK reservation RESTRICT chỉ chặn xóa cứng nên kiểm tra ở đây.
   */
  async remove(user: AuthUser, id: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      const a = await this.lockOwned(m, user, id);
      const pending = await m.exists(ArtworkReservation, {
        where: {
          artworkId: id,
          status: ReservationStatus.Active,
          expiresAt: MoreThan(new Date()),
        },
      });
      if (pending) {
        throw new BadRequestException(
          'Tác phẩm đang có đơn chờ thanh toán, chưa thể xóa',
        );
      }
      if (isPublic(a.status))
        await this.emit(m, a, CatalogEvents.ArtworkArchived, 'deleted');
      await m.softRemove(a);
    });
  }

  async bulk(
    user: AuthUser,
    dto: BulkArtworkDto,
  ): Promise<{ updated: number }> {
    return this.dataSource.transaction(async (m) => {
      const list = await m
        .createQueryBuilder(Artwork, 'a')
        .setLock('pessimistic_write')
        .where('a.id IN (:...ids) AND a.seller_id = :sid', {
          ids: dto.ids,
          sid: user.id,
        })
        .getMany();
      if (list.length !== dto.ids.length)
        throw new NotFoundException('Có tác phẩm không tồn tại');

      if (dto.action === BulkAction.Move) {
        const folderId = dto.folderId ?? null;
        await this.assertFolder(m, user.id, folderId);
        await m.update(Artwork, { id: In(dto.ids) }, { folderId });
        return { updated: list.length };
      }
      const target =
        dto.action === BulkAction.Archive
          ? ArtworkStatus.Archived
          : ArtworkStatus.Draft;
      const reason: ArchiveReason =
        dto.action === BulkAction.Archive ? 'archived' : 'unpublished';
      let updated = 0;
      for (const a of list) {
        if (a.status === target) continue;
        if (target === ArtworkStatus.Draft && !isPublic(a.status)) continue;
        await this.applyTransition(m, a, target, reason);
        updated++;
      }
      return { updated };
    });
  }

  // ───────────────────────────── Đọc ─────────────────────────────

  async getMine(user: AuthUser, id: string): Promise<ArtworkResponse> {
    const a = await this.artworks.findOne({ where: { id, sellerId: user.id } });
    if (!a) throw new NotFoundException('Không tìm thấy tác phẩm');
    const [res] = await this.hydrate([a], true);
    return res;
  }

  async listMine(
    user: AuthUser,
    q: InventoryQueryDto,
  ): Promise<Page<ArtworkResponse> & { counts: Record<string, number> }> {
    const qb = this.artworks
      .createQueryBuilder('a')
      .where('a.seller_id = :sid', { sid: user.id });
    if (!q.status)
      qb.andWhere('a.status <> :arch', { arch: ArtworkStatus.Archived });
    else if (q.status !== 'all')
      qb.andWhere('a.status = :st', { st: q.status });
    if (q.folderId === 'none') qb.andWhere('a.folder_id IS NULL');
    else if (q.folderId) qb.andWhere('a.folder_id = :fid', { fid: q.folderId });
    if (q.tagId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM artwork_tags t WHERE t.artwork_id = a.id AND t.tag_id = :tid)',
        { tid: q.tagId },
      );
    }
    this.applyCommonFilters(qb, q.q, q.listingType);
    this.applySort(qb, q.sort);
    const [rows, total] = await qb
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize)
      .getManyAndCount();

    // Số lượng theo trạng thái cho các tab: theo thư mục đang xem (không phụ thuộc tab đang chọn)
    const countQb = this.artworks
      .createQueryBuilder('a')
      .select('a.status', 'status')
      .addSelect('COUNT(*)', 'n')
      .where('a.seller_id = :sid', { sid: user.id });
    if (q.folderId === 'none') countQb.andWhere('a.folder_id IS NULL');
    else if (q.folderId)
      countQb.andWhere('a.folder_id = :fid', { fid: q.folderId });
    const countRows: { status: string; n: string }[] = await countQb
      .groupBy('a.status')
      .getRawMany();
    const counts: Record<string, number> = Object.fromEntries(
      Object.values(ArtworkStatus).map((s) => [s, 0]),
    );
    for (const r of countRows) counts[r.status] = Number(r.n);

    return { ...toPage(await this.hydrate(rows, true), total, q), counts };
  }

  /** Chi tiết công khai. Chủ tác phẩm xem được cả bản nháp của mình (để xem trước). */
  async getPublic(id: string, viewer?: AuthUser): Promise<ArtworkResponse> {
    const a = await this.artworks.findOne({ where: { id } });
    const isOwner = !!viewer && a?.sellerId === viewer.id;
    if (!a || (!isPublic(a.status) && !isOwner)) {
      throw new NotFoundException('Không tìm thấy tác phẩm');
    }
    const [res] = await this.hydrate([a], isOwner);
    return res;
  }

  async listPublic(q: PublicArtworkQueryDto): Promise<Page<ArtworkResponse>> {
    const qb = this.artworks
      .createQueryBuilder('a')
      .where('a.status IN (:...pub)', { pub: PUBLIC_STATUSES });
    if (q.sellerId) qb.andWhere('a.seller_id = :sid', { sid: q.sellerId });
    if (q.sellerSlug) {
      qb.andWhere(
        'a.seller_id = (SELECT s.seller_id FROM seller_summaries s WHERE s.slug = :slug)',
        { slug: q.sellerSlug },
      );
    }
    if (q.tag) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM artwork_tags at JOIN tags t ON t.id = at.tag_id
                 WHERE at.artwork_id = a.id AND t.slug = :tag)`,
        { tag: q.tag },
      );
    }
    this.applyCommonFilters(qb, q.q, q.listingType);
    this.applySort(qb, q.sort === 'updated' ? 'newest' : q.sort, true);
    const [rows, total] = await qb
      .skip((q.page - 1) * q.pageSize)
      .take(q.pageSize)
      .getManyAndCount();
    return toPage(await this.hydrate(rows, false), total, q);
  }

  // ───────────────────────────── Nội bộ ─────────────────────────────

  private applyFields(a: Artwork, dto: Partial<ArtworkInputDto>): void {
    for (const key of SCALAR_FIELDS) {
      const v = dto[key];
      if (v !== undefined) (a as unknown as Record<string, unknown>)[key] = v;
    }
    if (typeof a.description === 'string' && !a.description.trim())
      a.description = null;
    if (dto.folderId !== undefined) a.folderId = dto.folderId;
    if (
      a.listingType === ListingType.DisplayOnly ||
      a.listingType === ListingType.Sold
    ) {
      a.price = null;
      a.allowOffers = false;
    }
    if (a.listingType !== ListingType.Sold) {
      a.saleRecord = null;
    } else if (a.saleRecord) {
      if (
        a.saleRecord.soldAt &&
        a.saleRecord.soldAt > new Date().toISOString().slice(0, 10)
      ) {
        throw new BadRequestException('Ngày bán không được ở tương lai');
      }
      a.saleRecord = {
        collectorName: a.saleRecord.collectorName || null,
        showOnProfile: a.saleRecord.showOnProfile,
        soldPrice: a.saleRecord.soldPrice ?? null,
        soldAt: a.saleRecord.soldAt ?? null,
      };
    }
  }

  /** Đổi tổng số lượng, giữ nguyên phần đã bán / đang giữ chỗ (total − available). */
  private changeQuantity(a: Artwork, total: number): void {
    const held = a.quantityTotal - a.quantityAvailable;
    if (total < held) {
      throw new BadRequestException(
        `Đã bán hoặc đang giữ chỗ ${held} bản — số lượng tối thiểu là ${held}`,
      );
    }
    a.quantityTotal = total;
    a.quantityAvailable = total - held;
  }

  private assertPublishable(a: Artwork, imageCount: number): void {
    const errors = publishProblems(a, imageCount);
    if (errors.length) {
      throw new UnprocessableEntityException({ message: errors[0], errors });
    }
  }

  private async lockOwned(
    m: EntityManager,
    user: AuthUser,
    id: string,
  ): Promise<Artwork> {
    const a = await m.findOne(Artwork, {
      where: { id, sellerId: user.id },
      lock: { mode: 'pessimistic_write' },
    });
    if (!a) throw new NotFoundException('Không tìm thấy tác phẩm');
    return a;
  }

  private async transition(
    m: EntityManager,
    user: AuthUser,
    id: string,
    target: ArtworkStatus,
    reason: ArchiveReason,
  ): Promise<void> {
    const a = await this.lockOwned(m, user, id);
    if (a.status === target) return;
    await this.applyTransition(m, a, target, reason);
  }

  private async applyTransition(
    m: EntityManager,
    a: Artwork,
    target: ArtworkStatus,
    reason: ArchiveReason,
  ): Promise<void> {
    const wasPublic = isPublic(a.status);
    a.status = target;
    await m.save(a);
    if (wasPublic) await this.emit(m, a, CatalogEvents.ArtworkArchived, reason);
  }

  private async assertFolder(
    m: EntityManager,
    sellerId: string,
    folderId?: string | null,
  ) {
    if (!folderId) return;
    const ok = await m.exists(ArtworkFolder, {
      where: { id: folderId, sellerId },
    });
    if (!ok) throw new BadRequestException('Thư mục không tồn tại');
  }

  /** Chỉ được gắn tag hệ thống hoặc tag do chính seller tạo. */
  private async setTags(
    m: EntityManager,
    sellerId: string,
    artworkId: string,
    tagIds: string[],
  ) {
    if (tagIds.length) {
      const n = await m
        .createQueryBuilder(Tag, 't')
        .where('t.id IN (:...ids)', { ids: tagIds })
        .andWhere('(t.seller_id IS NULL OR t.seller_id = :sid)', {
          sid: sellerId,
        })
        .getCount();
      if (n !== tagIds.length)
        throw new BadRequestException('Có tag không hợp lệ');
    }
    await m.delete(ArtworkTag, { artworkId });
    if (tagIds.length) {
      await m.insert(
        ArtworkTag,
        tagIds.map((tagId) => ({ artworkId, tagId })),
      );
    }
  }

  /**
   * Ghi danh sách ảnh theo thứ tự. Trả về publicId các ảnh bị bỏ để xóa trên Cloudinary.
   * Ảnh mới: publicId phải nằm trong thư mục của seller (server đã cấp khi ký) + chữ ký hợp lệ.
   */
  private async writeImages(
    m: EntityManager,
    sellerId: string,
    artworkId: string,
    input: ArtworkImageInputDto[],
    existing: ArtworkImage[],
  ): Promise<string[]> {
    const ids = input.map((i) => i.publicId);
    if (new Set(ids).size !== ids.length)
      throw new BadRequestException('Ảnh bị trùng');

    const byId = new Map(existing.map((e) => [e.publicId, e]));
    const folder = `${this.cloudinary.folderFor('artworks', sellerId)}/`;
    const fresh: Partial<ArtworkImage>[] = [];
    const keep: ArtworkImage[] = [];

    input.forEach((img, position) => {
      const old = byId.get(img.publicId);
      if (old) {
        old.position = position;
        keep.push(old);
        return;
      }
      const complete =
        img.version &&
        img.signature &&
        img.format &&
        img.width &&
        img.height &&
        img.bytes;
      if (!complete)
        throw new BadRequestException(
          `Thiếu thông tin ảnh mới ${img.publicId}`,
        );
      if (!img.publicId.startsWith(folder))
        throw new BadRequestException('Ảnh không thuộc tài khoản của bạn');
      if (
        !this.cloudinary.verifyUploadResult(
          img.publicId,
          img.version!,
          img.signature!,
        )
      ) {
        throw new BadRequestException('Chữ ký ảnh không hợp lệ');
      }
      fresh.push({
        artworkId,
        publicId: img.publicId,
        version: img.version!,
        format: img.format!,
        width: img.width!,
        height: img.height!,
        bytes: img.bytes!,
        position,
      });
    });

    const gone = existing.filter((e) => !keep.includes(e));
    if (gone.length)
      await m.delete(ArtworkImage, { id: In(gone.map((g) => g.id)) });
    if (keep.length) await m.save(ArtworkImage, keep);
    if (fresh.length) {
      // Ảnh đã gắn vào tác phẩm khác (kể cả của chính seller) → unique index báo lỗi
      const taken = await m.exists(ArtworkImage, {
        where: { publicId: In(fresh.map((f) => f.publicId!)) },
      });
      if (taken)
        throw new BadRequestException('Ảnh đã được dùng cho tác phẩm khác');
      await m.insert(ArtworkImage, fresh);
    }
    return gone.map((g) => g.publicId);
  }

  private applyCommonFilters(
    qb: SelectQueryBuilder<Artwork>,
    q?: string,
    listingType?: ListingType,
  ) {
    if (q) {
      qb.andWhere(
        new Brackets((w) =>
          w
            .where("a.title ILIKE :q ESCAPE '\\'", { q: `%${escapeLike(q)}%` })
            .orWhere("a.creator_name ILIKE :q ESCAPE '\\'"),
        ),
      );
    }
    if (listingType) qb.andWhere('a.listing_type = :lt', { lt: listingType });
  }

  private applySort(
    qb: SelectQueryBuilder<Artwork>,
    sort: ArtworkSort,
    byPublished = false,
  ) {
    const created = byPublished ? 'a.publishedAt' : 'a.createdAt';
    switch (sort) {
      case 'oldest':
        qb.orderBy(created, 'ASC');
        break;
      case 'updated':
        qb.orderBy('a.updatedAt', 'DESC');
        break;
      case 'title':
        qb.orderBy('a.title', 'ASC');
        break;
      case 'price_asc':
        qb.orderBy('a.price', 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        qb.orderBy('a.price', 'DESC', 'NULLS LAST');
        break;
      default:
        qb.orderBy(created, 'DESC');
    }
    qb.addOrderBy('a.id', 'ASC'); // thứ tự ổn định khi phân trang
  }

  /** Nạp ảnh, tag, seller cho một trang kết quả bằng 3 truy vấn (tránh N+1). */
  private async hydrate(
    rows: Artwork[],
    isOwner: boolean,
  ): Promise<ArtworkResponse[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const m = this.dataSource.manager;
    const [images, links, sellers] = await Promise.all([
      m.find(ArtworkImage, {
        where: { artworkId: In(ids) },
        order: { position: 'ASC' },
      }),
      m.find(ArtworkTag, {
        where: { artworkId: In(ids) },
        relations: { tag: true },
      }),
      m.find(SellerSummary, {
        where: { sellerId: In([...new Set(rows.map((r) => r.sellerId))]) },
      }),
    ]);
    const sellerById = new Map(sellers.map((s) => [s.sellerId, s]));
    return rows.map((a) =>
      this.mapper.artwork(a, {
        images: images.filter((i) => i.artworkId === a.id),
        tags: links
          .filter((l) => l.artworkId === a.id && l.tag)
          .map((l) => l.tag!)
          .sort(
            (x, y) =>
              x.category.localeCompare(y.category) ||
              x.name.localeCompare(y.name, 'vi'),
          ),
        seller: sellerById.get(a.sellerId),
        isOwner,
      }),
    );
  }

  private async emit(
    m: EntityManager,
    a: Artwork,
    type: string,
    reason?: ArchiveReason,
  ): Promise<void> {
    const cover = await m.findOne(ArtworkImage, {
      where: { artworkId: a.id },
      order: { position: 'ASC' },
    });
    const event: DomainEvent<ArtworkSnapshotPayload> = {
      aggregateType: 'Artwork',
      aggregateId: a.id,
      type,
      payload: {
        artworkId: a.id,
        sellerId: a.sellerId,
        title: a.title,
        coverImageUrl: cover
          ? this.cloudinary.imageUrl(cover.publicId, cover.version, 'medium')
          : null,
        listingType: a.listingType,
        status: a.status,
        price: a.listingType === ListingType.Inquire ? null : a.price,
        quantityAvailable: a.quantityAvailable,
        ...(reason ? { reason } : {}),
      },
    };
    await this.outbox.enqueue(m, event);
  }
}
