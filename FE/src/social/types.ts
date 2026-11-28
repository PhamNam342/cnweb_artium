/**
 * Kiểu dùng chung cho mọi tính năng Social (like, bình luận, theo dõi, moments).
 * Khớp dữ liệu social service trả về (bảng user_summaries).
 */
export type { Page } from '../artworks/types';

/** Loại đối tượng được like / bình luận. */
export type SocialTargetType = 'artwork' | 'moment' | 'comment';

/** Thông tin rút gọn của một người dùng, hiển thị cạnh bình luận, trong danh sách theo dõi, moment... */
export interface UserSummary {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  /** Có giá trị nếu là nghệ sĩ. */
  sellerSlug: string | null;
  /** Người đang xem có theo dõi người này không (chỉ có ở API theo dõi). */
  isFollowing?: boolean;
}

/** Tên hiển thị khi social chưa có thông tin người dùng (projection chưa đồng bộ). */
export const UNKNOWN_USER_NAME = 'Người dùng Artium';
