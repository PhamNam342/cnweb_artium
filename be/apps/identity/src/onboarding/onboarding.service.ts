import { OutboxService } from '@app/database';
import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TokenService } from '../auth/token.service';
import { IDENTITY_CONFIG } from '../config/identity-config.provider';
import type { IdentityConfig } from '../config/identity-env';
import { identityEvents } from '../identity-events';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { SellersService } from '../sellers/sellers.service';
import { User } from '../users/entities/user.entity';
import { toUserResponse } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { OnboardingDto, OnboardingResponse } from './onboarding.dto';

@Injectable()
export class OnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly sellers: SellersService,
    private readonly tokens: TokenService,
    private readonly outbox: OutboxService,
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
  ) {}

  /**
   * Hoàn tất popup onboarding lần đầu, tất cả trong MỘT transaction:
   * cập nhật thông tin cơ bản; nếu là nghệ sĩ thì tạo hồ sơ người bán (+ role seller) và website;
   * đặt onboarding_completed_at. Trả về access token mới để FE dùng ngay role mới.
   */
  async complete(
    userId: string,
    dto: OnboardingDto,
  ): Promise<OnboardingResponse> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new ConflictException('Không tìm thấy tài khoản');
      if (user.onboardingCompletedAt)
        throw new ConflictException('Bạn đã hoàn tất onboarding');

      user.fullName = dto.fullName;
      if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
      if (dto.phone !== undefined) user.phone = dto.phone;
      if (dto.city !== undefined) user.city = dto.city;
      if (dto.interests !== undefined)
        user.interests = [...new Set(dto.interests)];
      user.onboardingCompletedAt = new Date();
      await repo.save(user);

      if (dto.role === 'artist' && dto.seller) {
        const existing = await manager
          .getRepository(SellerProfile)
          .findOneBy({ userId });
        const profile =
          existing ??
          (await this.sellers.createInTransaction(manager, userId, dto.seller));
        if (dto.websites?.length) {
          await this.sellers.replaceWebsitesInTransaction(
            manager,
            profile.id,
            dto.websites,
          );
        }
      }
      // createInTransaction có thể đã chuyển role sang seller => đọc lại để event có role mới nhất
      const fresh = await repo.findOneByOrFail({ id: userId });
      await this.outbox.enqueue(manager, identityEvents.userUpdated(fresh));
    });

    const user = await this.users.findFullById(userId);
    return {
      user: toUserResponse(user),
      accessToken: await this.tokens.signAccessToken(user),
      expiresIn: this.config.accessTtlSeconds,
    };
  }
}
