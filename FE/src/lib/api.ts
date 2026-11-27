/**
 * Client gọi API qua gateway.
 * - Access token chỉ giữ trong bộ nhớ (không localStorage) => chống XSS đánh cắp token lâu dài.
 * - Refresh token nằm trong cookie httpOnly do backend đặt; mọi request gửi kèm credentials.
 * - Gặp 401 => tự gọi /auth/refresh MỘT lần (dùng chung một promise nếu nhiều request cùng lúc) rồi thử lại.
 */
export const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

export class ApiError extends Error {
  readonly status: number;
  readonly details: string[];

  constructor(status: number, message: string, details: string[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let accessToken: string | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** AuthContext đăng ký callback để chuyển về trạng thái khách khi phiên hết hạn hẳn. */
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * Chạy fn nhưng nếu đang có một lần chạy dở thì dùng chung kết quả.
 * Bắt buộc cho /auth/refresh: refresh token xoay vòng, gọi song song 2 lần với cùng cookie
 * sẽ bị backend coi là dùng lại token (React StrictMode, nhiều request 401 cùng lúc...).
 */
const inflight = new Map<string, Promise<unknown>>();
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

type RefreshHandler = () => Promise<boolean>;
let refreshHandler: RefreshHandler | null = null;

export function setRefreshHandler(handler: RefreshHandler | null): void {
  refreshHandler = handler;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
  /** Không tự refresh khi 401 (dùng cho chính các route auth). */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = 'Đã có lỗi xảy ra, vui lòng thử lại.';
  let details: string[] = [];
  try {
    const data = (await res.json()) as { message?: string | string[]; errors?: unknown };
    if (Array.isArray(data.message)) {
      details = data.message;
      message = data.message[0] ?? message;
    } else if (typeof data.message === 'string') {
      message = data.message;
    }
    // 422 của catalog: { message, errors: [...] } — danh sách điều kiện còn thiếu
    if (Array.isArray(data.errors)) details = data.errors.filter((x) => typeof x === 'string');
  } catch {
    // body không phải JSON
  }
  if (res.status === 429) message = 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.';
  if (res.status === 502) message = 'Máy chủ tạm thời không khả dụng, vui lòng thử lại.';
  return new ApiError(res.status, message, details);
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== '') url.searchParams.set(k, v);
  }

  const send = () =>
    fetch(url.toString(), {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      credentials: 'include',
      signal: options.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

  let res: Response;
  try {
    res = await send();
  } catch {
    throw new ApiError(0, 'Không kết nối được máy chủ. Kiểm tra mạng hoặc backend.');
  }

  if (res.status === 401 && !options.skipRefresh && refreshHandler) {
    const ok = await singleFlight('refresh-handler', refreshHandler);
    if (ok) {
      res = await send();
    } else {
      onSessionExpired?.();
    }
  }

  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
