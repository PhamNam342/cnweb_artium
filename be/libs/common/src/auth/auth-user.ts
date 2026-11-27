export enum UserRole {
  Collector = 'collector',
  Seller = 'seller',
  Admin = 'admin',
}

/** Payload của access token (JWT HS256, ký bởi identity, mọi service tự verify). */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** email đã xác minh */
  ev: boolean;
}

/** User đã xác thực, gắn vào request.user. */
export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  emailVerified: boolean;
}
