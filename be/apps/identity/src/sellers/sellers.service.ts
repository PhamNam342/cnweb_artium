import { slugify, UserRole } from '@app/common';
import { OutboxService } from '@app/database';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { identityEvents } from '../identity-events';
import { User } from '../users/entities/user.entity';
import {
  CreateSellerProfileDto,
  ReplaceWebsitesDto,
  SellerWebsiteDto,
  UpdateSellerProfileDto,
} from './dto/seller.dto';
import {
  SellerProfile,
  SellerVerificationStatus,
} from './entities/seller-profile.entity';
import { SellerWebsite } from './entities/seller-website.entity';

const RESERVED_SLUGS = new Set([
  'me',
  'admin',
  'new',
  'edit',
  'settings',
  'api',
]);

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(SellerProfile)
    private readonly profiles: Repository<SellerProfile>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

  /** Trở thành người bán: tạo hồ sơ + thêm role seller. Client cần refresh để có token mới. */
  async create(
    userId: string,
    dto: CreateSellerProfileDto,
  ): Promise<SellerProfile> {
    await this.dataSource.transaction((manager) =>
      this.createInTransaction(manager, userId, dto),
    );
    return this.getByUserId(userId);
  }

  /**
   * Tạo hồ sơ người bán trong transaction có sẵn (dùng chung cho POST /sellers/me và onboarding).
   * Thêm role seller cho user và ghi event vào outbox.
   */
  async createInTransaction(
    manager: EntityManager,
    userId: string,
    dto: CreateSellerProfileDto,
  ): Promise<SellerProfile> {
    const repo = manager.getRepository(SellerProfile);
    if (await repo.exists({ where: { userId } })) {
      throw new ConflictException('Bạn đã có hồ sơ người bán');
    }
    const slug = dto.slug
      ? await this.assertSlugAvailable(manager, dto.slug)
      : await this.generateSlug(manager, dto.displayName);
    const profile = await repo.save(
      repo.create({ ...dto, userId, slug, socialLinks: dto.socialLinks ?? {} }),
    );

    const users = manager.getRepository(User);
    const user = await users.findOneByOrFail({ id: userId });
    // Người mua tạo hồ sơ bán => chuyển hẳn sang vai trò nghệ sĩ (mỗi tài khoản một vai trò)
    if (user.role === UserRole.Collector) {
      user.role = UserRole.Seller;
      await users.save(user);
    }
    await this.outbox.enqueue(
      manager,
      identityEvents.sellerProfileUpserted(profile),
      identityEvents.userUpdated(user),
    );
    return profile;
  }

  /** Kiểm tra slug còn trống (cho ô nhập slug ở FE). Có `name` => gợi ý slug từ tên. */
  async checkSlug(
    slug?: string,
    name?: string,
  ): Promise<{ slug: string; available: boolean; reason?: string }> {
    const candidate = slug ?? slugify(name ?? '', 100);
    if (!candidate || candidate.length < 3) {
      return {
        slug: candidate,
        available: false,
        reason: 'Slug cần ít nhất 3 ký tự',
      };
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate)) {
      return {
        slug: candidate,
        available: false,
        reason: 'Chỉ gồm a-z, 0-9 và dấu gạch ngang',
      };
    }
    if (RESERVED_SLUGS.has(candidate)) {
      return {
        slug: candidate,
        available: false,
        reason: 'Slug này không được phép dùng',
      };
    }
    const taken = await this.profiles.exists({ where: { slug: candidate } });
    return taken
      ? { slug: candidate, available: false, reason: 'Slug đã được sử dụng' }
      : { slug: candidate, available: true };
  }

  async update(
    userId: string,
    dto: UpdateSellerProfileDto,
  ): Promise<SellerProfile> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SellerProfile);
      const profile = await repo.findOneBy({ userId });
      if (!profile) throw new NotFoundException('Bạn chưa có hồ sơ người bán');
      if (dto.slug && dto.slug !== profile.slug) {
        await this.assertSlugAvailable(manager, dto.slug, profile.id);
      }
      Object.assign(profile, dto);
      await repo.save(profile);
      await this.outbox.enqueue(
        manager,
        identityEvents.sellerProfileUpserted(profile),
      );
    });
    return this.getByUserId(userId);
  }

  async replaceWebsites(
    userId: string,
    dto: ReplaceWebsitesDto,
  ): Promise<SellerProfile> {
    await this.dataSource.transaction(async (manager) => {
      const profile = await manager
        .getRepository(SellerProfile)
        .findOneBy({ userId });
      if (!profile) throw new NotFoundException('Bạn chưa có hồ sơ người bán');
      await this.replaceWebsitesInTransaction(
        manager,
        profile.id,
        dto.websites,
      );
    });
    return this.getByUserId(userId);
  }

  async replaceWebsitesInTransaction(
    manager: EntityManager,
    profileId: string,
    websites: SellerWebsiteDto[],
  ): Promise<void> {
    const repo = manager.getRepository(SellerWebsite);
    await repo.delete({ sellerProfileId: profileId });
    await repo.save(
      websites.map((w, i) =>
        repo.create({
          sellerProfileId: profileId,
          type: w.type ?? 'portfolio',
          title: w.title,
          url: w.url,
          isVisible: w.isVisible ?? true,
          displayOrder: w.displayOrder ?? i,
        }),
      ),
    );
  }

  async setVerification(
    profileId: string,
    status: SellerVerificationStatus,
  ): Promise<SellerProfile> {
    if (
      ![
        SellerVerificationStatus.Verified,
        SellerVerificationStatus.Rejected,
      ].includes(status)
    ) {
      throw new BadRequestException(
        'Chỉ có thể duyệt (verified) hoặc từ chối (rejected)',
      );
    }
    const userId = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SellerProfile);
      const profile = await repo.findOneBy({ id: profileId });
      if (!profile)
        throw new NotFoundException('Không tìm thấy hồ sơ người bán');
      profile.verificationStatus = status;
      profile.verifiedAt =
        status === SellerVerificationStatus.Verified ? new Date() : null;
      await repo.save(profile);
      await this.outbox.enqueue(
        manager,
        identityEvents.sellerProfileUpserted(profile),
      );
      return profile.userId;
    });
    return this.getByUserId(userId);
  }

  /** Seller gửi yêu cầu xác minh (unverified/rejected -> pending). */
  async requestVerification(userId: string): Promise<SellerProfile> {
    const profile = await this.getByUserId(userId);
    if (profile.verificationStatus === SellerVerificationStatus.Verified) {
      throw new BadRequestException('Hồ sơ đã được xác minh');
    }
    await this.profiles.update(profile.id, {
      verificationStatus: SellerVerificationStatus.Pending,
    });
    return this.getByUserId(userId);
  }

  async getByUserId(userId: string): Promise<SellerProfile> {
    const profile = await this.profiles.findOne({
      where: { userId },
      relations: { websites: true },
    });
    if (!profile) throw new NotFoundException('Bạn chưa có hồ sơ người bán');
    return profile;
  }

  async getBySlug(slug: string): Promise<SellerProfile> {
    const profile = await this.profiles
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.websites', 'w')
      .innerJoin('p.user', 'u', "u.status = 'active' AND u.deleted_at IS NULL")
      .where('p.slug = :slug', { slug })
      .getOne();
    if (!profile) throw new NotFoundException('Không tìm thấy người bán');
    return profile;
  }

  private async assertSlugAvailable(
    manager: EntityManager,
    slug: string,
    exceptId?: string,
  ) {
    if (RESERVED_SLUGS.has(slug))
      throw new ConflictException('Slug này không được phép dùng');
    const taken = await manager.getRepository(SellerProfile).exists({
      where: exceptId ? { slug, id: Not(exceptId) } : { slug },
    });
    if (taken) throw new ConflictException('Slug đã được sử dụng');
    return slug;
  }

  private async generateSlug(
    manager: EntityManager,
    displayName: string,
  ): Promise<string> {
    const base = slugify(displayName, 100) || 'seller';
    const repo = manager.getRepository(SellerProfile);
    let candidate = base.length < 3 ? `${base}-art` : base;
    for (let i = 0; i < 5; i++) {
      if (
        !RESERVED_SLUGS.has(candidate) &&
        !(await repo.exists({ where: { slug: candidate } }))
      ) {
        return candidate;
      }
      candidate = `${base}-${randomBytes(2).toString('hex')}`;
    }
    throw new ConflictException('Không tạo được slug, vui lòng tự chọn slug');
  }
}
