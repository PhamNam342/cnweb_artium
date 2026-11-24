import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoginDecor, RegisterDecor } from './Decor';

const PERKS = [
  'Trang portfolio cá nhân và kho tác phẩm cho nghệ sĩ',
  'Khám phá, lưu moodboard và theo dõi nghệ sĩ yêu thích',
  'Thanh toán an toàn qua PayOS, hóa đơn có mã QR',
];

/** Bố cục chia đôi: khối đen thương hiệu bên trái, form bên phải. */
export function AuthLayout({
  variant,
  children,
}: {
  variant: 'login' | 'register';
  children: ReactNode;
}) {
  return (
    <div className="auth">
      <aside className="auth__aside">
        {variant === 'login' ? <LoginDecor /> : <RegisterDecor />}
        <Link to="/" className="logo">
          ARTIUM
        </Link>

        {variant === 'login' ? (
          <>
            <div className="auth__tiles" aria-hidden="true">
              <div className="tile" style={{ height: 300 }}>
                Ảnh tác phẩm
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="tile" style={{ height: 180 }}>
                  Ảnh tác phẩm
                </div>
                <div
                  className="tile"
                  style={{
                    height: 104,
                    background: 'var(--c-green)',
                    color: 'var(--c-text)',
                    fontWeight: 600,
                    fontSize: 15,
                  }}
                >
                  Cộng đồng nghệ thuật Việt
                </div>
              </div>
            </div>
            <p className="auth__headline">
              Chào mừng bạn trở lại
              <br />
              <span>với cộng đồng nghệ thuật.</span>
            </p>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              <p className="auth__headline">
                Một tài khoản,
                <br />
                <span>để sáng tác và sưu tầm.</span>
              </p>
              <ul className="perks">
                {PERKS.map((p) => (
                  <li key={p}>
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#00D973"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      style={{ flex: 'none' }}
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p style={{ fontSize: 13, color: 'var(--c-text-3)' }}>
              Bạn sẽ chọn vai trò (nhà sưu tầm hoặc nghệ sĩ) ngay sau khi đăng ký.
            </p>
          </>
        )}
      </aside>
      <main className="auth__main">{children}</main>
    </div>
  );
}
