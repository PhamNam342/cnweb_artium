import { describe, expect, it } from 'vitest';
import { checkPassword } from './password';
import { slugify } from './slugify';

describe('checkPassword (khớp rule backend)', () => {
  it('chặn mật khẩu thiếu số hoặc quá ngắn', () => {
    expect(checkPassword('abcdefgh').valid).toBe(false);
    expect(checkPassword('abc123').valid).toBe(false);
  });
  it('chấp nhận 8+ ký tự có chữ và số; mạnh khi dài và có ký tự đặc biệt', () => {
    expect(checkPassword('matkhau1')).toMatchObject({ valid: true, score: 2 });
    expect(checkPassword('Mat-khau-rat-manh-1')).toMatchObject({ valid: true, score: 3 });
  });
  it('chặn quá 72 ký tự', () => {
    expect(checkPassword('a1'.repeat(37)).valid).toBe(false);
  });
});

describe('slugify', () => {
  it('bỏ dấu tiếng Việt', () => {
    expect(slugify('Phòng Tranh Đà Lạt')).toBe('phong-tranh-da-lat');
  });
});
