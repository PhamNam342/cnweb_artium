import { OutboxService } from '@app/database';
import { CloudinaryService } from '@app/storage';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { identityEvents } from '../identity-events';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { SetAvatarDto } from './dto/avatar.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { User, UserStatus } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Thư mục Cloudinary riêng cho ảnh đại diện của user, VD: artium/avatars/<userId> */
  avatarFolder(userId: string): string {
    return this.cloudinary.folderFor('avatars', userId);
  }

  /** Cấp chữ ký để trình duyệt upload 1 ảnh đại diện thẳng lên Cloudinary. */
  avatarUploadTicket(userId: string) {
    return this.cloudinary.createUploadTicket(this.avatarFolder(userId), 1);
  }

  /**
   * Gắn ảnh vừa upload làm ảnh đại diện (xác minh chữ ký + thư mục), đồng bộ sang hồ sơ
   * nghệ sĩ nếu có. Ảnh cũ trên Cloudinary bị xóa sau khi lưu.
   */
  async setAvatar(userId: string, dto: SetAvatarDto): Promise<User> {
    if (!dto.publicId.startsWith(`${this.avatarFolder(userId)}/`)) {
      throw new BadRequestException('Ảnh không thuộc tài khoản của bạn');
    }
    if (
      !this.cloudinary.verifyUploadResult(
        dto.publicId,
        dto.version,
        dto.signature,
      )
    ) {
      throw new BadRequestException('Chữ ký ảnh không hợp lệ');
    }
    const url = this.cloudinary.imageUrl(dto.publicId, dto.version, 'avatar');
    const old = await this.replaceAvatar(userId, url);
    await this.destroyOwnAvatar(userId, old);
    return this.findFullById(userId);
  }

  async removeAvatar(userId: string): Promise<User> {
    const old = await this.replaceAvatar(userId, null);
    await this.destroyOwnAvatar(userId, old);
    return this.findFullById(userId);
  }

  /** Đổi avatar của user (+ hồ sơ nghệ sĩ nếu đang dùng chung ảnh). Trả về URL cũ. */
  private async replaceAvatar(
    userId: string,
    url: string | null,
  ): Promise<string | null> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo.findOneByOrFail({ id: userId });
      const old = user.avatarUrl;
      user.avatarUrl = url;
      await repo.save(user);
      await this.outbox.enqueue(manager, identityEvents.userUpdated(user));

      // Hồ sơ nghệ sĩ: cập nhật khi chưa có ảnh riêng hoặc đang dùng chung ảnh với tài khoản
      const profiles = manager.getRepository(SellerProfile);
      const profile = await profiles.findOneBy({ userId });
      if (
        profile &&
        (profile.avatarUrl === null || profile.avatarUrl === old)
      ) {
        profile.avatarUrl = url;
        await profiles.save(profile);
        await this.outbox.enqueue(
          manager,
          identityEvents.sellerProfileUpserted(profile),
        );
      }
      return old;
    });
  }

  /** Chỉ xóa ảnh nằm trong thư mục avatar của chính user (không đụng ảnh Google, ảnh khác). */
  private async destroyOwnAvatar(
    userId: string,
    url: string | null,
  ): Promise<void> {
    const publicId = this.cloudinary.publicIdFromUrl(url);
    if (publicId?.startsWith(`${this.avatarFolder(userId)}/`)) {
      await this.cloudinary.destroy([publicId]);
    }
  }

  /** Lấy user kèm oauth + seller profile (và password_hash để biết hasPassword). */
  async findFullById(id: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .leftJoinAndSelect('u.oauthAccounts', 'oa')
      .leftJoinAndMapOne(
        'u.sellerProfile',
        SellerProfile,
        'sp',
        'sp.user_id = u.id',
      )
      .where('u.id = :id', { id })
      .getOne();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async findPublicById(id: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('u')
      .leftJoinAndMapOne(
        'u.sellerProfile',
        SellerProfile,
        'sp',
        'sp.user_id = u.id',
      )
      .where('u.id = :id AND u.status = :status', {
        id,
        status: UserStatus.Active,
      })
      .getOne();
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async updateMe(id: string, dto: UpdateMeDto): Promise<User> {
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const user = await repo.findOneByOrFail({ id });
      if (dto.fullName !== undefined) user.fullName = dto.fullName.trim();
      if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
      if (dto.phone !== undefined) user.phone = dto.phone;
      await repo.save(user);
      await this.outbox.enqueue(manager, identityEvents.userUpdated(user));
    });
    return this.findFullById(id);
  }
}
