import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthUser, UserRole } from './auth-user';
import { ROLES_KEY } from './auth.decorators';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required?.length) return true;
    const user = ctx
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>().user;
    if (user && required.includes(user.role)) return true;
    throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
  }
}
