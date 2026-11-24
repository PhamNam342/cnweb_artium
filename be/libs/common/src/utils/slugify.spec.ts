import { slugify } from './slugify';

describe('slugify', () => {
  it('bỏ dấu tiếng Việt và chữ đ', () => {
    expect(slugify('Nguyễn Văn Đạt')).toBe('nguyen-van-dat');
    expect(slugify('Phòng tranh Hà Nội — Gallery #1')).toBe(
      'phong-tranh-ha-noi-gallery-1',
    );
  });

  it('cắt độ dài và không để gạch ngang ở cuối', () => {
    expect(slugify('abc def ghi', 4)).toBe('abc');
    expect(slugify('  --hello--  ')).toBe('hello');
  });
});
