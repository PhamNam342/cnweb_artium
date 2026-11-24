/** Thể loại cho bước "Bạn quan tâm thể loại nào?" — lưu slug vào users.interests. */
export const INTEREST_OPTIONS = [
  { slug: 'son-dau', label: 'Tranh sơn dầu' },
  { slug: 'son-mai', label: 'Sơn mài' },
  { slug: 'lua', label: 'Lụa' },
  { slug: 'mau-nuoc', label: 'Màu nước' },
  { slug: 'dieu-khac', label: 'Điêu khắc' },
  { slug: 'nhiep-anh', label: 'Nhiếp ảnh' },
  { slug: 'tranh-so', label: 'Tranh số' },
  { slug: 'gom', label: 'Gốm' },
  { slug: 'truu-tuong', label: 'Trừu tượng' },
  { slug: 'duong-dai', label: 'Đương đại' },
] as const;

/** Gợi ý cho ô thành phố (người dùng vẫn gõ tự do được). */
export const CITY_SUGGESTIONS = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Đà Nẵng',
  'Hải Phòng',
  'Cần Thơ',
  'Huế',
  'Khánh Hòa',
  'Lâm Đồng',
  'Quảng Ninh',
];

export const SELLER_TYPES = [
  { id: 'individual', label: 'Cá nhân' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'institution', label: 'Tổ chức' },
] as const;
