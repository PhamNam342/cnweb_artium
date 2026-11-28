import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Avatar } from '../components/Avatar';
import { UNKNOWN_USER_NAME, type UserSummary } from './types';

interface UserChipProps {
  /** null/undefined => hiện "Người dùng Artium" (social chưa có thông tin người này). */
  user: Pick<UserSummary, 'fullName' | 'avatarUrl'> | null | undefined;
  size?: number;
  /** Dòng phụ dưới tên: thời gian, "@slug"... */
  meta?: ReactNode;
  /** Có thì bấm vào tên / avatar để đi tới trang này. */
  to?: string;
  className?: string;
}

/**
 * Avatar + tên người dùng. Dùng chung cho bình luận, danh sách theo dõi, moment.
 * Chưa có trang nghệ sĩ công khai nên mặc định không có liên kết; truyền `to` khi cần.
 */
export function UserChip({ user, size = 36, meta, to, className }: UserChipProps) {
  const name = user?.fullName?.trim() || UNKNOWN_USER_NAME;
  const body = (
    <>
      <Avatar name={name} url={user?.avatarUrl} size={size} />
      <span className="user-chip__text">
        <span className="user-chip__name">{name}</span>
        {meta && <span className="user-chip__meta">{meta}</span>}
      </span>
    </>
  );
  const cls = ['user-chip', className].filter(Boolean).join(' ');
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}
