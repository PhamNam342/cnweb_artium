import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/auth-context';
import { PasswordField } from '../components/PasswordField';
import { ApiError } from '../lib/api';
import { checkPassword } from '../lib/password';

const RESEND_SECONDS = 60;

type Step = 'idle' | 'sent' | 'done';

/**
 * Đổi (hoặc đặt lần đầu) mật khẩu bằng mã 6 số gửi qua email.
 * Thành công: thiết bị khác bị đăng xuất, thiết bị này giữ phiên (nhận token mới).
 */
export function PasswordSection() {
  const { user, requestPasswordCode, changePasswordWithCode } = useAuth();
  const [step, setStep] = useState<Step>('idle');
  const [sentTo, setSentTo] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [errors, setErrors] = useState<{ code?: string; pw?: string; pw2?: string; form?: string }>(
    {},
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!user) return null;
  const setting = !user.hasPassword; // tài khoản Google chưa có mật khẩu → đặt lần đầu

  async function send() {
    setBusy(true);
    setErrors({});
    try {
      const r = await requestPasswordCode();
      setSentTo(r.sentTo);
      setStep('sent');
      setCooldown(RESEND_SECONDS);
      setCode('');
    } catch (e) {
      setErrors({ form: e instanceof ApiError ? e.message : 'Không gửi được mã, thử lại sau' });
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\d{6}$/.test(code)) next.code = 'Nhập đủ 6 chữ số trong email';
    if (!checkPassword(pw).valid) next.pw = 'Tối thiểu 8 ký tự, gồm chữ cái và chữ số';
    if (pw2 !== pw) next.pw2 = 'Mật khẩu nhập lại không khớp';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await changePasswordWithCode(code, pw);
      setStep('done');
      setCode('');
      setPw('');
      setPw2('');
    } catch (x) {
      const msg = x instanceof ApiError ? x.message : 'Không đổi được mật khẩu';
      // Lỗi về mã hiện dưới ô mã; còn lại hiện chung
      setErrors(/mã/i.test(msg) ? { code: msg } : { form: msg });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="form-card" aria-label="Mật khẩu">
      <div className="security-row">
        <div>
          <h2 className="form-card__title">Mật khẩu</h2>
          <p className="form-card__desc security-row__desc">
            {setting
              ? 'Tài khoản đang đăng nhập bằng Google. Đặt mật khẩu để đăng nhập được cả bằng email.'
              : 'Để đổi mật khẩu, Artium gửi mã xác nhận 6 số tới email của bạn.'}
          </p>
        </div>
        {step !== 'sent' && (
          <button
            type="button"
            className="btn btn--outline btn--sm"
            disabled={busy}
            onClick={() => void send()}
          >
            {busy ? 'Đang gửi…' : setting ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}
          </button>
        )}
      </div>

      {step === 'done' && (
        <p className="alert alert--success" role="status">
          {setting ? 'Đã đặt mật khẩu.' : 'Đã đổi mật khẩu.'} Các thiết bị khác đã được đăng xuất.
        </p>
      )}
      {errors.form && (
        <p className="alert alert--error" role="alert">
          {errors.form}
        </p>
      )}

      {step === 'sent' && (
        <form className="wizard__stack" onSubmit={(e) => void submit(e)} noValidate>
          <p className="alert alert--info" role="status">
            Đã gửi mã tới <strong>{sentTo}</strong>. Mã có hiệu lực 10 phút — kiểm tra cả thư mục
            Spam.
          </p>
          <div className="field">
            <label className="field__label" htmlFor="pw-code">
              Mã xác nhận
            </label>
            <div className="code-row">
              <input
                id="pw-code"
                className="input code-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={code}
                aria-invalid={errors.code ? true : undefined}
                aria-describedby={errors.code ? 'pw-code-err' : undefined}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  setErrors((x) => ({ ...x, code: undefined }));
                }}
              />
              <button
                type="button"
                className="btn-link"
                disabled={cooldown > 0 || busy}
                onClick={() => void send()}
              >
                {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : 'Gửi lại mã'}
              </button>
            </div>
            {errors.code && (
              <span id="pw-code-err" className="field__error">
                {errors.code}
              </span>
            )}
          </div>
          <PasswordField
            label="Mật khẩu mới"
            value={pw}
            onChange={(v) => {
              setPw(v);
              setErrors((x) => ({ ...x, pw: undefined }));
            }}
            autoComplete="new-password"
            showStrength
            error={errors.pw}
          />
          <PasswordField
            label="Nhập lại mật khẩu mới"
            value={pw2}
            onChange={(v) => {
              setPw2(v);
              setErrors((x) => ({ ...x, pw2: undefined }));
            }}
            autoComplete="new-password"
            error={errors.pw2}
          />
          <div className="modal__footer-actions" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => {
                setStep('idle');
                setErrors({});
              }}
            >
              Hủy
            </button>
            <button type="submit" className="btn btn--primary" disabled={busy}>
              {busy ? 'Đang lưu…' : setting ? 'Đặt mật khẩu' : 'Đổi mật khẩu'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
