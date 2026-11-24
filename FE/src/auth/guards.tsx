import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';

function FullPageSpinner() {
  return (
    <div className="page-center" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">Đang tải…</span>
    </div>
  );
}

/** Chỉ cho người đã đăng nhập; chưa đăng nhập => /login và quay lại trang cũ sau đó. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'guest') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <>{children}</>;
}

/** Trang chỉ dành cho khách (login/register); đã đăng nhập => /home. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <FullPageSpinner />;
  if (status === 'authenticated') return <Navigate to="/home" replace />;
  return <>{children}</>;
}
