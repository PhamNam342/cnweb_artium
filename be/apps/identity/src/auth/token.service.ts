import { AccessTokenPayload, generateToken, sha256 } from '@app/common';
import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, IsNull } from 'typeorm';
import { IDENTITY_CONFIG } from '../config/identity-config.provider';
import type { IdentityConfig } from '../config/identity-env';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';

export interface ClientMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface IssuedRefreshToken {
  token: string;
  expiresAt: Date;
}

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    @Inject(IDENTITY_CONFIG) private readonly config: IdentityConfig,
  ) {}

  signAccessToken(user: User): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      ev: user.emailVerifiedAt !== null,
    };
    return this.jwt.signAsync(payload, {
      expiresIn: this.config.accessTtlSeconds,
    });
  }

  /** Tạo refresh token mới. familyId undefined => phiên đăng nhập mới. */
  async issueRefreshToken(
    manager: EntityManager,
    userId: string,
    meta: ClientMeta,
    familyId: string = randomUUID(),
  ): Promise<IssuedRefreshToken & { id: string }> {
    const token = generateToken();
    const expiresAt = new Date(
      Date.now() + this.config.refreshTtlDays * 86_400_000,
    );
    const saved = await manager.getRepository(RefreshToken).save({
      userId,
      familyId,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 512) ?? null,
      ipAddress: meta.ipAddress?.slice(0, 64) ?? null,
    });
    return { id: saved.id, token, expiresAt };
  }

  /**
   * Xoay vòng refresh token. Token cũ bị thu hồi, token mới cùng family.
   * Nếu token đã bị thu hồi mà vẫn được dùng => có thể bị đánh cắp => thu hồi cả family.
   */
  async rotate(
    rawToken: string,
    meta: ClientMeta,
  ): Promise<{ userId: string } & IssuedRefreshToken> {
    const outcome = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(RefreshToken);
      const current = await repo.findOne({
        where: { tokenHash: sha256(rawToken) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) return { error: 'invalid' as const };

      if (current.revokedAt) {
        // Vừa bị xoay trong khoảng ân hạn (tab khác refresh cùng lúc) => cấp token mới cùng family
        const graceMs = this.config.refreshReuseGraceSeconds * 1000;
        const justRotated =
          current.replacedById !== null &&
          Date.now() - current.revokedAt.getTime() < graceMs;
        if (justRotated && current.expiresAt.getTime() > Date.now()) {
          const next = await this.issueRefreshToken(
            manager,
            current.userId,
            meta,
            current.familyId,
          );
          return {
            userId: current.userId,
            token: next.token,
            expiresAt: next.expiresAt,
          };
        }
        await repo.update(
          { familyId: current.familyId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        return { error: 'reused' as const, userId: current.userId };
      }
      if (current.expiresAt.getTime() <= Date.now())
        return { error: 'expired' as const };

      const next = await this.issueRefreshToken(
        manager,
        current.userId,
        meta,
        current.familyId,
      );
      await repo.update(current.id, {
        revokedAt: new Date(),
        replacedById: next.id,
      });
      return {
        userId: current.userId,
        token: next.token,
        expiresAt: next.expiresAt,
      };
    });

    if ('error' in outcome) {
      if (outcome.error === 'reused') {
        this.logger.warn(
          `Phát hiện dùng lại refresh token của user ${outcome.userId}`,
        );
      }
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }
    return outcome;
  }

  async revoke(rawToken: string): Promise<void> {
    await this.dataSource
      .getRepository(RefreshToken)
      .update(
        { tokenHash: sha256(rawToken), revokedAt: IsNull() },
        { revokedAt: new Date() },
      );
  }

  async revokeAllForUser(
    userId: string,
    manager?: EntityManager,
  ): Promise<void> {
    await (manager ?? this.dataSource.manager)
      .getRepository(RefreshToken)
      .update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
