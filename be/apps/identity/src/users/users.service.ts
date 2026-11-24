import { OutboxService } from '@app/database';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { identityEvents } from '../identity-events';
import { SellerProfile } from '../sellers/entities/seller-profile.entity';
import { UpdateMeDto } from './dto/update-me.dto';
import { User, UserStatus } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly outbox: OutboxService,
  ) {}

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
