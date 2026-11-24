import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser, UserRole } from './auth-user';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

/** Bỏ qua JwtAuthGuard (route công khai). Nếu có token hợp lệ vẫn gắn request.user. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Yêu cầu user có ít nhất một trong các role. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | undefined =>
    ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>().user,
);
