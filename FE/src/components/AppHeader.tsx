import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { UserMenu } from './UserMenu';

/** Thanh trên cùng của các trang sau đăng nhập. Ô tìm kiếm dẫn tới trang Khám phá. */
export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  if (!user) return null;
  return (
    <header className="app-header">
      <Link to="/home" className="logo" style={{ fontSize: 22 }}>
        ARTIUM
      </Link>
      <form
        className="app-header__search-form"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(q.trim() ? `/home?q=${encodeURIComponent(q.trim())}` : '/home');
        }}
      >
        <input
          className="app-header__search"
          type="search"
          placeholder="Tìm tác phẩm, nghệ sĩ…"
          aria-label="Tìm kiếm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </form>
      <div className="app-header__user">
        {user.role === 'seller' && (
          <Link to="/studio/artworks/new" className="btn btn--primary btn--sm app-header__cta">
            + Đăng tác phẩm
          </Link>
        )}
        <UserMenu />
      </div>
    </header>
  );
}
