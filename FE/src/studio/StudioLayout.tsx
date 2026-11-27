import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AppHeader } from '../components/AppHeader';
import { Icon, type IconName } from '../components/Icon';

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end: boolean;
  sellerOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: '/home', label: 'Khám phá', icon: 'compass', end: true },
  {
    to: '/studio/artworks',
    label: 'Kho tác phẩm',
    icon: 'inventory',
    end: false,
    sellerOnly: true,
  },
  { to: '/profile', label: 'Hồ sơ', icon: 'user', end: true },
];

/** Khung chung cho mọi trang sau đăng nhập: header + menu trái (theo Figma "Inventory"). */
export function AppLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const { user } = useAuth();
  return (
    <>
      <AppHeader />
      <div className="studio">
        <nav className="studio__nav" aria-label="Điều hướng chính">
          {NAV.filter((n) => !n.sellerOnly || user?.role === 'seller').map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className="studio__link">
              <Icon name={n.icon} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="studio__main" data-wide={wide || undefined}>
          {children}
        </main>
      </div>
    </>
  );
}

/** Giữ tên cũ cho các trang studio. */
export const StudioLayout = AppLayout;

/** Chỉ tài khoản nghệ sĩ mới vào được trang studio. */
export function RequireSeller({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (user?.role === 'seller') return <>{children}</>;
  return (
    <AppLayout>
      <div className="empty">
        <h1 style={{ fontSize: 24 }}>Trang dành cho nghệ sĩ</h1>
        <p className="empty__title" style={{ maxWidth: 420 }}>
          Tài khoản của bạn là tài khoản nhà sưu tầm. Chỉ tài khoản nghệ sĩ hoặc gallery mới đăng
          được tác phẩm.
        </p>
        <Link to="/home" className="btn btn--outline">
          Về trang Khám phá
        </Link>
      </div>
    </AppLayout>
  );
}
