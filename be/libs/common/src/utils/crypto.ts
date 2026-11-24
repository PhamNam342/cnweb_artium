import { createHash, randomBytes } from 'node:crypto';

/** Token ngẫu nhiên an toàn, dạng base64url (mặc định 48 byte ~ 64 ký tự). */
export function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}

/** SHA-256 hex (64 ký tự) — dùng để lưu token, không lưu bản rõ. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
