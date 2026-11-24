import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { Avatar } from '../components/Avatar';
import { ApiError } from '../lib/api';
import { OnboardingModal } from '../onboarding/OnboardingModal';

const SECTIONS = [
  { title: 'Tác phẩm từ người bạn theo dõi', count: 5, height: 240 },
  { title: 'Sự kiện sắp tới', count: 4, height: 200 },
  { title: 'Nghệ sĩ gần bạn', count: 6, height: 180 },
];

/** Trang chính sau đăng nhập. Nội dung thật sẽ đến từ catalog/social; hiện là khung chờ. */
export function HomePage() {
  const { user, logout, resendVerification } = useAuth();
  const navigate = useNavigate();
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  if (!user) return null;

  async function onResend() {
    try {
      await resendVerification();
      setVerifyMsg('Đã gửi lại email xác minh.');
    } catch (e) {
      setVerifyMsg(e instanceof ApiError ? e.message : 'Không gửi được, thử lại sau.');
    }
  }

  return (
    <>
      <header className="app-header">
        <Link to="/" className="logo" style={{ fontSize: 22 }}>
          ARTIUM
        </Link>
        <input
          className="app-header__search"
          type="search"
          placeholder="Tìm tác phẩm, nghệ sĩ, sự kiện…"
          aria-label="Tìm kiếm"
        />
        <div className="app-header__user">
          {user.sellerSlug && (
            <span className="badge" title={`artium.vn/${user.sellerSlug}`}>
              Nghệ sĩ
            </span>
          )}
          <Avatar name={user.fullName} url={user.avatarUrl} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{user.fullName}</span>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            onClick={() => void logout().then(() => navigate('/', { replace: true }))}
          >
            Đăng xuất
          </button>
        </div>
      </header>

      {!user.emailVerified && (
        <div className="banner" role="status">
          <span>
            {verifyMsg ?? `Hãy xác minh email ${user.email} để dùng đầy đủ tính năng mua bán.`}
          </span>
          {!verifyMsg && (
            <button
              type="button"
              className="btn btn--sm btn--outline"
              onClick={() => void onResend()}
            >
              Gửi lại email
            </button>
          )}
        </div>
      )}

      <main className="home" aria-hidden={!user.onboardingCompleted || undefined}>
        <h1>Xin chào, {user.fullName}</h1>
        {SECTIONS.map((s) => (
          <section key={s.title} aria-label={s.title}>
            <h2 className="home__section-title">{s.title}</h2>
            <div className="skeleton-row">
              {Array.from({ length: s.count }, (_, i) => (
                <div key={i} className="skeleton" style={{ height: s.height }}>
                  Sắp ra mắt
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {!user.onboardingCompleted && <OnboardingModal user={user} />}
    </>
  );
}
