import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicApi } from '../artworks/artworks-api';
import { useAuth } from '../auth/auth-context';
import { INTEREST_OPTIONS } from '../lib/options';
import { AvatarEditor } from '../profile/AvatarEditor';
import { PasswordSection } from '../profile/PasswordSection';

const ROLE_LABEL = {
  collector: 'Nhà sưu tầm',
  seller: 'Nghệ sĩ / Gallery',
  admin: 'Quản trị viên',
} as const;

/** Hồ sơ tài khoản (chỉ xem; trang sửa hồ sơ sẽ làm ở bước sau). */
export function ProfilePage() {
  const { user } = useAuth();
  // Sở thích lưu theo slug tag: lấy tên hiển thị từ danh sách tag hệ thống
  const [tagNames, setTagNames] = useState<Record<string, string>>({});
  useEffect(() => {
    publicApi
      .systemTags()
      .then((tags) => setTagNames(Object.fromEntries(tags.map((t) => [t.slug, t.name]))))
      .catch(() => undefined);
  }, []);
  if (!user) return null;
  const interests = user.interests.map(
    (slug) => INTEREST_OPTIONS.find((o) => o.slug === slug)?.label ?? tagNames[slug] ?? slug,
  );
  const rows: [string, string][] = [
    ['Email', `${user.email}${user.emailVerified ? '' : ' (chưa xác minh)'}`],
    ['Vai trò', ROLE_LABEL[user.role]],
    ['Thành phố', user.city ?? '—'],
    ['Sở thích', interests.length ? interests.join(', ') : '—'],
    [
      'Đăng nhập bằng',
      [
        user.hasPassword && 'Mật khẩu',
        ...user.linkedProviders.map((p) => (p === 'google' ? 'Google' : p)),
      ]
        .filter(Boolean)
        .join(', '),
    ],
    ['Tham gia', new Date(user.createdAt).toLocaleDateString('vi-VN')],
  ];
  return (
    <div className="profile">
      <section className="profile__card">
        <AvatarEditor />
        <div>
          <h1>{user.fullName}</h1>
          <p>{ROLE_LABEL[user.role]}</p>
          {user.sellerSlug && <p className="profile__slug">artium.vn/{user.sellerSlug}</p>}
        </div>
      </section>
      <section className="form-card" aria-label="Thông tin tài khoản">
        <h2 className="form-card__title">Thông tin tài khoản</h2>
        <dl className="facts">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <PasswordSection />
      {user.role === 'seller' && (
        <section className="studio-cta" aria-label="Studio">
          <div>
            <h2 className="home__section-title">Studio của bạn</h2>
            <p>Quản lý kho tác phẩm, đăng tác phẩm mới và theo dõi trạng thái niêm yết.</p>
          </div>
          <div className="inventory__actions">
            <Link to="/studio/artworks" className="btn btn--outline">
              Kho tác phẩm
            </Link>
            <Link to="/studio/artworks/new" className="btn btn--primary">
              Đăng tác phẩm
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
