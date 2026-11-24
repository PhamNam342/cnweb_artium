import { generateToken, sha256 } from '@app/common';
import { OutboxService } from '@app/database';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager, IsNull, MoreThan } from 'typeorm';
import { IDENTITY_CONFIG } from '../config/identity-config.provider';
import type { IdentityConfig } from '../config/identity-env';
import { identityEvents } from '../identity-events';
import {
  OAuthAccount,
  OAuthProvider,
} from '../users/entities/oauth-account.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { toUserResponse } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { AuthResponse } from './dto/auth-response';
import {
  ChangePasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto/auth.dto';
import { UserToken, UserTokenType } from './entities/user-token.entity';
import { GoogleVerifierService } from './google-verifier.service';
import { PasswordService } from './password.service';
import { ClientMeta, IssuedRefreshToken, TokenService } from './token.service';

/** Kết quả đăng nhập: body trả cho client + refresh token để controller đặt vào cookie. */
export interface AuthSession {
  body: AuthResponse;
  refresh: IssuedRefreshToken;
}

const INVALID_CREDENTIALS = 'Email hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly google: GoogleVerifierService,
    private readonly outbox: OutboxService,
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
  ) {}

  // ------------------------------------------------------------------ đăng ký / đăng nhập

  async register(dto: RegisterDto, meta: ClientMeta): Promise<AuthSession> {
    const passwordHash = await this.passwords.hash(dto.password);
    const { userId, refresh } = await this.dataSource.transaction(
      async (manager) => {
        const repo = manager.getRepository(User);
        if (
          await repo.exists({ where: { email: dto.email }, withDeleted: true })
        ) {
          throw new ConflictException('Email đã được sử dụng');
        }
        const user = await repo.save(
          repo.create({
            email: dto.email,
            fullName: dto.fullName.trim(),
            passwordHash,
          }),
        );
        const verify = await this.createUserToken(
          manager,
          user,
          UserTokenType.EmailVerification,
        );
        await this.outbox.enqueue(
          manager,
          identityEvents.userRegistered(user, 'password'),
          identityEvents.emailVerificationRequested(
            user,
            verify.url,
            verify.expiresAt,
          ),
        );
        const refresh = await this.tokens.issueRefreshToken(
          manager,
          user.id,
          meta,
        );
        return { userId: user.id, refresh };
      },
    );
    return this.buildSession(userId, refresh);
  }

  async login(dto: LoginDto, meta: ClientMeta): Promise<AuthSession> {
    const user = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .addSelect('u.passwordHash')
      .where('u.email = :email', { email: dto.email })
      .getOne();

    const ok = await this.passwords.verify(user?.passwordHash, dto.password);
    if (!user || !ok) throw new UnauthorizedException(INVALID_CREDENTIALS);
    this.assertActive(user);

    const refresh = await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(User)
        .update(user.id, { lastLoginAt: new Date() });
      return this.tokens.issueRefreshToken(manager, user.id, meta);
    });
    return this.buildSession(user.id, refresh);
  }

  /**
   * Đăng nhập Google:
   * 1. Đã liên kết (provider_user_id) => đăng nhập.
   * 2. Chưa liên kết nhưng email trùng user có sẵn và Google xác nhận email => tự liên kết.
   * 3. Chưa có user => tạo mới (không mật khẩu, email coi như đã xác minh).
   */
  async loginWithGoogle(
    idToken: string,
    meta: ClientMeta,
  ): Promise<AuthSession> {
    const g = await this.google.verify(idToken);

    const { userId, refresh } = await this.dataSource.transaction(
      async (manager) => {
        const users = manager.getRepository(User);
        const accounts = manager.getRepository(OAuthAccount);

        let account = await accounts.findOne({
          where: { provider: OAuthProvider.Google, providerUserId: g.sub },
        });
        let user: User | null = account
          ? await users.findOneBy({ id: account.userId })
          : await users.findOne({
              where: { email: g.email },
              withDeleted: true,
            });

        if (user?.deletedAt)
          throw new ForbiddenException('Tài khoản đã bị xóa');

        if (!user) {
          user = await users.save(
            users.create({
              email: g.email,
              fullName: g.name,
              avatarUrl: g.picture,
              emailVerifiedAt: g.emailVerified ? new Date() : null,
            }),
          );
          await this.outbox.enqueue(
            manager,
            identityEvents.userRegistered(user, 'google'),
          );
        } else if (!account && !g.emailVerified) {
          throw new UnauthorizedException(
            'Email Google chưa được xác minh, không thể liên kết với tài khoản sẵn có',
          );
        }

        if (!account) {
          account = await accounts.save(
            accounts.create({
              userId: user.id,
              provider: OAuthProvider.Google,
              providerUserId: g.sub,
              email: g.email,
            }),
          );
        }

        this.assertActive(user);
        const patch: Partial<User> = { lastLoginAt: new Date() };
        if (
          !user.emailVerifiedAt &&
          g.emailVerified &&
          user.email === g.email
        ) {
          patch.emailVerifiedAt = new Date();
        }
        if (!user.avatarUrl && g.picture) patch.avatarUrl = g.picture;
        await users.update(user.id, patch);

        const refresh = await this.tokens.issueRefreshToken(
          manager,
          user.id,
          meta,
        );
        return { userId: user.id, refresh };
      },
    );
    return this.buildSession(userId, refresh);
  }

  async refresh(
    rawToken: string | undefined,
    meta: ClientMeta,
  ): Promise<AuthSession> {
    if (!rawToken) throw new UnauthorizedException('Thiếu refresh token');
    const rotated = await this.tokens.rotate(rawToken, meta);
    const user = await this.users.findFullById(rotated.userId);
    this.assertActive(user);
    return this.buildSession(user.id, rotated);
  }

  async logout(rawToken: string | undefined): Promise<void> {
    if (rawToken) await this.tokens.revoke(rawToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
  }

  // ------------------------------------------------------------------ xác minh email

  async verifyEmail(rawToken: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const token = await this.consumeUserToken(
        manager,
        rawToken,
        UserTokenType.EmailVerification,
      );
      const users = manager.getRepository(User);
      const user = await users.findOneByOrFail({ id: token.userId });
      if (!user.emailVerifiedAt) {
        user.emailVerifiedAt = new Date();
        await users.save(user);
        await this.outbox.enqueue(manager, identityEvents.userUpdated(user));
      }
    });
  }

  async resendVerification(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager
        .getRepository(User)
        .findOneByOrFail({ id: userId });
      if (user.emailVerifiedAt)
        throw new BadRequestException('Email đã được xác minh');
      await this.throttleUserToken(
        manager,
        user.id,
        UserTokenType.EmailVerification,
      );
      const verify = await this.createUserToken(
        manager,
        user,
        UserTokenType.EmailVerification,
      );
      await this.outbox.enqueue(
        manager,
        identityEvents.emailVerificationRequested(
          user,
          verify.url,
          verify.expiresAt,
        ),
      );
    });
  }

  // ------------------------------------------------------------------ mật khẩu

  /** Luôn trả thành công (kể cả email không tồn tại) để không lộ email nào đã đăng ký. */
  async forgotPassword(email: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.getRepository(User).findOneBy({ email });
      if (!user || user.status !== UserStatus.Active) return;
      const recent = await manager.getRepository(UserToken).exists({
        where: {
          userId: user.id,
          type: UserTokenType.PasswordReset,
          usedAt: IsNull(),
          createdAt: MoreThan(new Date(Date.now() - 60_000)),
        },
      });
      if (recent) return; // chống spam: tối đa 1 email/phút
      const reset = await this.createUserToken(
        manager,
        user,
        UserTokenType.PasswordReset,
      );
      await this.outbox.enqueue(
        manager,
        identityEvents.passwordResetRequested(user, reset.url, reset.expiresAt),
      );
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.dataSource.transaction(async (manager) => {
      const token = await this.consumeUserToken(
        manager,
        dto.token,
        UserTokenType.PasswordReset,
      );
      await manager.getRepository(User).update(token.userId, { passwordHash });
      await this.tokens.revokeAllForUser(token.userId, manager); // đăng xuất mọi thiết bị
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.users.findFullById(userId);
    if (user.passwordHash) {
      if (!dto.currentPassword)
        throw new BadRequestException('Cần nhập mật khẩu hiện tại');
      const ok = await this.passwords.verify(
        user.passwordHash,
        dto.currentPassword,
      );
      if (!ok) throw new UnauthorizedException('Mật khẩu hiện tại không đúng');
    }
    const passwordHash = await this.passwords.hash(dto.newPassword);
    await this.dataSource.getRepository(User).update(userId, { passwordHash });
  }

  // ------------------------------------------------------------------ helpers

  private async buildSession(
    userId: string,
    refresh: IssuedRefreshToken,
  ): Promise<AuthSession> {
    const user = await this.users.findFullById(userId);
    return {
      body: {
        accessToken: await this.tokens.signAccessToken(user),
        expiresIn: this.config.accessTtlSeconds,
        tokenType: 'Bearer',
        user: toUserResponse(user),
      },
      refresh,
    };
  }

  private assertActive(user: User): void {
    if (user.status !== UserStatus.Active)
      throw new ForbiddenException('Tài khoản đã bị khóa');
  }

  private async createUserToken(
    manager: EntityManager,
    user: User,
    type: UserTokenType,
  ) {
    const raw = generateToken(32);
    const ttlMs =
      type === UserTokenType.EmailVerification
        ? this.config.emailVerificationTtlHours * 3_600_000
        : this.config.passwordResetTtlMinutes * 60_000;
    const expiresAt = new Date(Date.now() + ttlMs);
    const repo = manager.getRepository(UserToken);
    // Vô hiệu token cũ cùng loại chưa dùng => chỉ link mới nhất có hiệu lực
    await repo.update(
      { userId: user.id, type, usedAt: IsNull() },
      { expiresAt: new Date() },
    );
    await repo.save({
      userId: user.id,
      type,
      tokenHash: sha256(raw),
      expiresAt,
    });
    const path =
      type === UserTokenType.EmailVerification
        ? 'verify-email'
        : 'reset-password';
    return { url: `${this.config.webOrigin}/${path}?token=${raw}`, expiresAt };
  }

  private async throttleUserToken(
    manager: EntityManager,
    userId: string,
    type: UserTokenType,
  ) {
    const recent = await manager.getRepository(UserToken).exists({
      where: {
        userId,
        type,
        createdAt: MoreThan(new Date(Date.now() - 60_000)),
      },
    });
    if (recent)
      throw new BadRequestException('Vui lòng đợi 1 phút trước khi gửi lại');
  }

  private async consumeUserToken(
    manager: EntityManager,
    raw: string,
    type: UserTokenType,
  ) {
    const repo = manager.getRepository(UserToken);
    const token = await repo.findOne({
      where: { tokenHash: sha256(raw), type },
      lock: { mode: 'pessimistic_write' },
    });
    if (!token || token.usedAt || token.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Liên kết không hợp lệ hoặc đã hết hạn');
    }
    token.usedAt = new Date();
    await repo.save(token);
    return token;
  }
}
