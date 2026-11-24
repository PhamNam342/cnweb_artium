import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { ApiError } from '../lib/api';
import { CITY_SUGGESTIONS, INTEREST_OPTIONS, SELLER_TYPES } from '../lib/options';
import { slugify } from '../lib/slugify';
import type { OnboardingPayload, SellerProfileType, User } from '../lib/types';
import { BrushIcon, PhotoIcon } from './RoleIcons';
import { useSlugCheck } from './useSlugCheck';

type Role = 'collector' | 'artist';
type Step = 'role' | 'collector' | 'artist-profile' | 'artist-links';

const PHONE_RE = /^(\+84|0)\d{9,10}$/;
const TAX_RE = /^\d{10}(-\d{3})?$/;
const URL_RE = /^https?:\/\/\S+\.\S+/;

const SOCIALS = [
  { key: 'instagram', label: 'Instagram', ph: 'https://instagram.com/…' },
  { key: 'facebook', label: 'Facebook', ph: 'https://facebook.com/…' },
  { key: 'tiktok', label: 'TikTok', ph: 'https://tiktok.com/@…' },
  { key: 'website', label: 'Website / portfolio', ph: 'https://…' },
] as const;
type SocialKey = (typeof SOCIALS)[number]['key'];

function Steps({ total, done }: { total: number; done: number }) {
  return (
    <div
      className="steps"
      style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} data-done={i < done} />
      ))}
    </div>
  );
}

/**
 * Popup onboarding lần đầu. Không có nút đóng: user phải chọn vai trò để tiếp tục dùng app.
 * Gửi MỘT request POST /users/me/onboarding ở bước cuối (backend xử lý trong một transaction).
 */
export function OnboardingModal({ user }: { user: User }) {
  const { completeOnboarding } = useAuth();
  const [step, setStep] = useState<Step>('role');
  const [role, setRole] = useState<Role>('collector');

  // Thông tin cơ bản
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [interests, setInterests] = useState<string[]>(user.interests ?? []);

  // Hồ sơ nghệ sĩ
  const [displayName, setDisplayName] = useState(user.fullName);
  const [slug, setSlug] = useState(slugify(user.fullName));
  const [slugEdited, setSlugEdited] = useState(false);
  const [profileType, setProfileType] = useState<SellerProfileType>('individual');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [socials, setSocials] = useState<Record<SocialKey, string>>({
    instagram: '',
    facebook: '',
    tiktok: '',
    website: '',
  });
  const [showBiz, setShowBiz] = useState(false);
  const [taxCode, setTaxCode] = useState('');
  const [bizAddress, setBizAddress] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const { result: slugResult, checking: slugChecking } = useSlugCheck(
    step === 'artist-profile' ? slug : '',
  );

  // Đưa focus vào tiêu đề mỗi bước (trình đọc màn hình đọc đúng bước mới)
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [step]);

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  // Khóa cuộn trang nền khi popup mở
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function onDisplayName(v: string) {
    setDisplayName(v);
    if (!slugEdited) setSlug(slugify(v));
  }

  const phoneError =
    phone && !PHONE_RE.test(phone.replace(/\s/g, '')) ? 'Số điện thoại không hợp lệ' : '';
  const collectorValid = fullName.trim().length >= 2 && !phoneError;
  const artistProfileValid =
    collectorValid &&
    displayName.trim().length >= 2 &&
    slug.length >= 3 &&
    slugResult?.available === true;
  const socialErrors = Object.fromEntries(
    SOCIALS.map((s) => [
      s.key,
      socials[s.key] && !URL_RE.test(socials[s.key])
        ? 'Cần là đường dẫn bắt đầu bằng https://'
        : '',
    ]),
  ) as Record<SocialKey, string>;
  const taxError =
    taxCode && !TAX_RE.test(taxCode)
      ? 'Mã số thuế gồm 10 hoặc 13 chữ số (dạng 0123456789-001)'
      : '';
  const linksValid = Object.values(socialErrors).every((e) => !e) && !taxError;

  async function submit(includeLinks: boolean) {
    setError(null);
    setSubmitting(true);
    const payload: OnboardingPayload = {
      role,
      fullName: fullName.trim(),
      phone: phone ? phone.replace(/\s/g, '') : undefined,
      city: city.trim() || undefined,
      interests,
    };
    if (role === 'artist') {
      const socialLinks = includeLinks
        ? Object.fromEntries(Object.entries(socials).filter(([, v]) => v.trim()))
        : undefined;
      payload.seller = {
        displayName: displayName.trim(),
        slug,
        profileType,
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        socialLinks,
        taxCode: includeLinks && taxCode ? taxCode : undefined,
        businessAddress:
          includeLinks && bizAddress.trim() ? { line1: bizAddress.trim() } : undefined,
      };
    }
    try {
      await completeOnboarding(payload);
      // Thành công => user.onboardingCompleted = true => HomePage tự đóng popup
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không lưu được, vui lòng thử lại');
      setSubmitting(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (step === 'role') goTo(role === 'artist' ? 'artist-profile' : 'collector');
    else if (step === 'collector' && collectorValid) void submit(false);
    else if (step === 'artist-profile' && artistProfileValid) goTo('artist-links');
    else if (step === 'artist-links' && linksValid) void submit(true);
  }

  const basicFields = (
    <div className="grid-2">
      <div className="field">
        <label htmlFor="ob-name" className="field__label">
          Họ và tên
        </label>
        <input
          id="ob-name"
          className="input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          autoComplete="name"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="ob-phone" className="field__label">
          Số điện thoại <small>(không bắt buộc)</small>
        </label>
        <input
          id="ob-phone"
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0912 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          aria-invalid={phoneError ? true : undefined}
          aria-describedby={phoneError ? 'ob-phone-err' : undefined}
        />
        {phoneError && (
          <p id="ob-phone-err" className="field__error">
            {phoneError}
          </p>
        )}
      </div>
      <div className="field span-2">
        <label htmlFor="ob-city" className="field__label">
          Tỉnh / thành phố <small>(không bắt buộc)</small>
        </label>
        <input
          id="ob-city"
          className="input"
          list="ob-city-list"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="VD: Hà Nội"
        />
        <datalist id="ob-city-list">
          {CITY_SUGGESTIONS.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
    </div>
  );

  const errorBox = error && (
    <p className="alert alert--error" role="alert">
      {error}
    </p>
  );

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className={`modal${step === 'artist-profile' ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
      >
        <form onSubmit={onSubmit} noValidate style={{ display: 'contents' }}>
          {step === 'role' && (
            <>
              <div className="modal__head">
                <span className="modal__eyebrow">Bước 1 · Chọn vai trò</span>
                <h2 id="ob-title" className="modal__title" tabIndex={-1}>
                  Chào {user.fullName.split(' ').slice(-1)[0]}, bạn tham gia Artium với vai trò nào?
                </h2>
                <p className="modal__desc">
                  Nghệ sĩ vẫn có thể mua và sưu tầm. Bạn có thể trở thành nghệ sĩ sau trong phần Cài
                  đặt.
                </p>
              </div>
              <div className="role-grid" role="radiogroup" aria-label="Vai trò">
                {(
                  [
                    {
                      id: 'collector',
                      title: 'Nhà sưu tầm',
                      tint: '#DBEAFE',
                      icon: <PhotoIcon />,
                      body: 'Khám phá, lưu và mua tác phẩm; theo dõi nghệ sĩ và tham gia sự kiện.',
                    },
                    {
                      id: 'artist',
                      title: 'Nghệ sĩ / Gallery',
                      tint: '#D1FAE5',
                      icon: <BrushIcon />,
                      body: 'Đăng và bán tác phẩm, có trang portfolio riêng, hóa đơn QR và công cụ CRM.',
                    },
                  ] as const
                ).map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    role="radio"
                    aria-checked={role === r.id}
                    className="role-card"
                    onClick={() => setRole(r.id)}
                  >
                    <span className="role-card__top">
                      <span className="role-card__icon" style={{ background: r.tint }}>
                        {r.icon}
                      </span>
                      <span className="role-card__radio" />
                    </span>
                    <span className="role-card__title">{r.title}</span>
                    <span className="role-card__body">{r.body}</span>
                  </button>
                ))}
              </div>
              <div className="modal__footer">
                <span className="field__hint">
                  {role === 'artist'
                    ? 'Còn 2 bước nữa · khoảng 2 phút'
                    : 'Còn 1 bước nữa · khoảng 1 phút'}
                </span>
                <button type="submit" className="btn btn--primary">
                  Tiếp tục
                </button>
              </div>
            </>
          )}

          {step === 'collector' && (
            <>
              <div className="modal__head">
                <Steps total={2} done={2} />
                <span className="modal__eyebrow">Bước 2/2 · Nhà sưu tầm</span>
                <h2 id="ob-title" className="modal__title" tabIndex={-1}>
                  Hoàn thiện hồ sơ của bạn
                </h2>
              </div>
              {basicFields}
              <fieldset
                style={{
                  margin: 0,
                  padding: 0,
                  border: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <legend className="field__label" style={{ padding: 0, marginBottom: 10 }}>
                  Bạn quan tâm thể loại nào? <small>({interests.length} đã chọn)</small>
                </legend>
                <div className="chips">
                  {INTEREST_OPTIONS.map((o) => {
                    const on = interests.includes(o.slug);
                    return (
                      <button
                        key={o.slug}
                        type="button"
                        className="chip"
                        aria-pressed={on}
                        onClick={() =>
                          setInterests((cur) =>
                            on ? cur.filter((x) => x !== o.slug) : [...cur, o.slug],
                          )
                        }
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {errorBox}
              <div className="modal__footer">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => goTo('role')}
                  disabled={submitting}
                >
                  ← Quay lại
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={!collectorValid || submitting}
                >
                  {submitting ? 'Đang lưu…' : 'Hoàn tất & khám phá'}
                </button>
              </div>
            </>
          )}

          {step === 'artist-profile' && (
            <>
              <div className="modal__head">
                <Steps total={3} done={2} />
                <span className="modal__eyebrow">Bước 2/3 · Hồ sơ nghệ sĩ</span>
                <h2 id="ob-title" className="modal__title" tabIndex={-1}>
                  Tạo trang nghệ sĩ của bạn
                </h2>
              </div>
              <div className="artist-layout">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {basicFields}
                  <div className="field">
                    <label htmlFor="ob-display" className="field__label">
                      Tên hiển thị trên trang nghệ sĩ
                    </label>
                    <input
                      id="ob-display"
                      className="input"
                      value={displayName}
                      onChange={(e) => onDisplayName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ob-slug" className="field__label">
                      Đường dẫn trang
                    </label>
                    <div className="prefix-input">
                      <span className="prefix-input__prefix">artium.vn/</span>
                      <input
                        id="ob-slug"
                        value={slug}
                        onChange={(e) => {
                          setSlugEdited(true);
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                        }}
                        aria-describedby="ob-slug-status"
                        aria-invalid={slugResult && !slugResult.available ? true : undefined}
                      />
                      <span
                        id="ob-slug-status"
                        className="prefix-input__status"
                        aria-live="polite"
                        style={{
                          color: slugResult?.available ? 'var(--c-green-text)' : 'var(--c-danger)',
                        }}
                      >
                        {slugChecking ? (
                          <span style={{ color: 'var(--c-text-2)' }}>Đang kiểm tra…</span>
                        ) : slugResult ? (
                          slugResult.available ? (
                            '✓ Còn trống'
                          ) : (
                            slugResult.reason
                          )
                        ) : (
                          ''
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="field">
                    <span id="ob-type-label" className="field__label">
                      Bạn là
                    </span>
                    <div className="segmented" role="radiogroup" aria-labelledby="ob-type-label">
                      {SELLER_TYPES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={profileType === t.id}
                          className="chip"
                          onClick={() => setProfileType(t.id)}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="ob-bio" className="field__label">
                      Giới thiệu ngắn <small>(không bắt buộc)</small>
                    </label>
                    <textarea
                      id="ob-bio"
                      className="input"
                      rows={3}
                      maxLength={5000}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Phong cách, chất liệu bạn hay dùng, hành trình sáng tác…"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ob-loc" className="field__label">
                      Nơi làm việc <small>(không bắt buộc)</small>
                    </label>
                    <input
                      id="ob-loc"
                      className="input"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="VD: Hội An, Quảng Nam"
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <span className="field__label">Xem trước</span>
                  <div className="preview-card" aria-hidden="true">
                    <div className="preview-card__cover" />
                    <div className="preview-card__body">
                      <span className="preview-card__avatar">
                        {(displayName.trim()[0] ?? 'A').toUpperCase()}
                      </span>
                      <span style={{ fontSize: 18, fontWeight: 600 }}>
                        {displayName.trim() || 'Tên hiển thị'}
                      </span>
                      <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>
                        artium.vn/{slug || 'ten-cua-ban'} ·{' '}
                        {SELLER_TYPES.find((t) => t.id === profileType)?.label}
                      </span>
                      {location && (
                        <span style={{ fontSize: 13, color: 'var(--c-text-2)' }}>{location}</span>
                      )}
                      <span className="badge">Chưa xác minh</span>
                    </div>
                  </div>
                  <p className="field__hint" style={{ lineHeight: 1.5 }}>
                    Ảnh đại diện và ảnh bìa sẽ thêm được khi có chức năng tải ảnh. Sau khi hoàn tất,
                    bạn có thể gửi yêu cầu xác minh để nhận huy hiệu xanh.
                  </p>
                </div>
              </div>
              <div className="modal__footer">
                <button type="button" className="btn-link" onClick={() => goTo('role')}>
                  ← Quay lại
                </button>
                <button type="submit" className="btn btn--primary" disabled={!artistProfileValid}>
                  Tiếp tục
                </button>
              </div>
            </>
          )}

          {step === 'artist-links' && (
            <>
              <div className="modal__head">
                <Steps total={3} done={3} />
                <span className="modal__eyebrow">Bước 3/3 · Không bắt buộc</span>
                <h2 id="ob-title" className="modal__title" tabIndex={-1}>
                  Kết nối kênh của bạn
                </h2>
                <p className="modal__desc">
                  Giúp nhà sưu tầm tìm hiểu thêm về bạn. Có thể bổ sung sau trong trang hồ sơ.
                </p>
              </div>
              <div className="grid-2">
                {SOCIALS.map((s) => (
                  <div key={s.key} className="field">
                    <label htmlFor={`ob-${s.key}`} className="field__label">
                      {s.label}
                    </label>
                    <input
                      id={`ob-${s.key}`}
                      className="input"
                      type="url"
                      inputMode="url"
                      placeholder={s.ph}
                      value={socials[s.key]}
                      onChange={(e) => setSocials((cur) => ({ ...cur, [s.key]: e.target.value }))}
                      aria-invalid={socialErrors[s.key] ? true : undefined}
                    />
                    {socialErrors[s.key] && <p className="field__error">{socialErrors[s.key]}</p>}
                  </div>
                ))}
              </div>
              <div className="collapsible">
                <button
                  type="button"
                  className="collapsible__toggle"
                  aria-expanded={showBiz}
                  aria-controls="ob-biz"
                  onClick={() => setShowBiz((v) => !v)}
                >
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>Thông tin kinh doanh</span>
                    <span className="field__hint">
                      Cần khi xuất hóa đơn hoặc nhận chi trả. Chỉ bạn nhìn thấy.
                    </span>
                  </span>
                  <span aria-hidden="true" style={{ fontSize: 20, color: 'var(--c-text-2)' }}>
                    {showBiz ? '−' : '+'}
                  </span>
                </button>
                {showBiz && (
                  <div id="ob-biz" className="grid-2">
                    <div className="field">
                      <label htmlFor="ob-tax" className="field__label">
                        Mã số thuế
                      </label>
                      <input
                        id="ob-tax"
                        className="input"
                        inputMode="numeric"
                        placeholder="10 hoặc 13 chữ số"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value.trim())}
                        aria-invalid={taxError ? true : undefined}
                      />
                      {taxError && <p className="field__error">{taxError}</p>}
                    </div>
                    <div className="field">
                      <label htmlFor="ob-addr" className="field__label">
                        Địa chỉ kinh doanh
                      </label>
                      <input
                        id="ob-addr"
                        className="input"
                        placeholder="Số nhà, phường, quận…"
                        value={bizAddress}
                        onChange={(e) => setBizAddress(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
              {errorBox}
              <div className="modal__footer">
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => goTo('artist-profile')}
                  disabled={submitting}
                >
                  ← Quay lại
                </button>
                <div className="modal__footer-actions">
                  <button
                    type="button"
                    className="btn btn--light"
                    onClick={() => void submit(false)}
                    disabled={submitting}
                  >
                    Bỏ qua
                  </button>
                  <button
                    type="submit"
                    className="btn btn--primary"
                    disabled={!linksValid || submitting}
                  >
                    {submitting ? 'Đang lưu…' : 'Hoàn tất & tới trang của tôi'}
                  </button>
                </div>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
