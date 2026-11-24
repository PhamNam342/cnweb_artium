import type { CookieOptions, Request, Response } from 'express';

export const REFRESH_COOKIE = 'artium_rt';
/** Cookie chỉ gửi tới các route auth => giảm bề mặt tấn công. */
const COOKIE_PATH = '/api/auth';

function options(secure: boolean, expires?: Date): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: COOKIE_PATH,
    expires,
  };
}

export function setRefreshCookie(
  res: Response,
  token: string,
  expires: Date,
  secure: boolean,
) {
  res.cookie(REFRESH_COOKIE, token, options(secure, expires));
}

export function clearRefreshCookie(res: Response, secure: boolean) {
  res.clearCookie(REFRESH_COOKIE, options(secure));
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string> | undefined;
  return cookies?.[REFRESH_COOKIE];
}
