import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AccessTokenPayload, AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './auth.decorators';

/** Guard toàn cục: mọi route cần access token trừ khi gắn @Public(). */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.extractToken(req);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Thiếu access token');
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      req.user = {
        id: payload.sub,
        email: payload.email,
        roles: payload.roles,
        emailVerified: payload.ev,
      };
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException(
        'Access token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  private extractToken(req: Request): string | undefined {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
