/** Chuyển chuỗi (kể cả tiếng Việt có dấu) thành slug: "Nguyễn Văn Đạt" -> "nguyen-van-dat". */
export function slugify(input: string, maxLength = 100): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
}
