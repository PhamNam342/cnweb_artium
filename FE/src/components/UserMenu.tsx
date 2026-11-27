import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Avatar } from './Avatar';
import { Icon } from './Icon';

const ROLE_LABEL = { collector: 'Nhà sưu tầm', seller: 'Nghệ sĩ', admin: 'Quản trị' } as const;

/** Bấm vào tên/ảnh đại diện → menu: Hồ sơ, Kho tác phẩm (nghệ sĩ), Đăng xuất. */
export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!user) return null;
  const close = () => setOpen(false);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.fullName} url={user.avatarUrl} />
        <span className="user-menu__name">{user.fullName}</span>
        <Icon name="chevronDown" size={16} />
      </button>
      {open && (
        <div className="menu__list user-menu__list" role="menu">
          <div className="user-menu__head">
            <strong>{user.fullName}</strong>
            <span>{user.email}</span>
            <span className="badge">{ROLE_LABEL[user.role]}</span>
          </div>
          <Link to="/profile" role="menuitem" className="menu__item" onClick={close}>
            <Icon name="user" /> Hồ sơ
          </Link>
          {user.role === 'seller' && (
            <Link to="/studio/artworks" role="menuitem" className="menu__item" onClick={close}>
              <Icon name="inventory" /> Kho tác phẩm
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu__item menu__item--danger"
            onClick={() => {
              close();
              void logout().then(() => navigate('/', { replace: true }));
            }}
          >
            <Icon name="logout" /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
