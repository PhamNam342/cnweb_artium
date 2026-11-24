import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { PasswordField } from '../components/PasswordField';
import { api, ApiError } from '../lib/api';
import { checkPassword } from '../lib/password';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/auth/forgot-password', { body: { email: email.trim() }, skipRefresh: true });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gửi yêu cầu thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout variant="login">
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <div>
          <h1 className="auth__title">Quên mật khẩu</h1>
          <p className="auth__sub">
            Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.
          </p>
        </div>
        {sent ? (
          <p className="alert alert--success" role="status">
            Nếu email tồn tại trong hệ thống, liên kết đặt lại mật khẩu đã được gửi. Liên kết có
            hiệu lực trong 30 phút.
          </p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="fp-email" className="field__label">
                Email
              </label>
              <input
                id="fp-email"
                className="input"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="alert alert--error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={submitting || !email}
            >
              {submitting ? 'Đang gửi…' : 'Gửi liên kết'}
            </button>
          </>
        )}
        <Link to="/login">← Quay lại đăng nhập</Link>
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api('/auth/reset-password', {
        body: { token, newPassword: password },
        skipRefresh: true,
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đặt lại mật khẩu thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout variant="login">
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <h1 className="auth__title">Đặt mật khẩu mới</h1>
        {!token ? (
          <p className="alert alert--error">Liên kết không hợp lệ. Hãy yêu cầu gửi lại liên kết.</p>
        ) : done ? (
          <p className="alert alert--success" role="status">
            Đặt lại mật khẩu thành công. Mọi phiên đăng nhập cũ đã bị đăng xuất.
          </p>
        ) : (
          <>
            <PasswordField
              label="Mật khẩu mới"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              showStrength
            />
            {error && (
              <p className="alert alert--error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn--primary btn--lg btn--block"
              disabled={submitting || !checkPassword(password).valid}
            >
              {submitting ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
            </button>
          </>
        )}
        <Link to={done ? '/login' : '/forgot-password'}>
          {done ? 'Đăng nhập ngay →' : 'Gửi lại liên kết'}
        </Link>
      </form>
    </AuthLayout>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'pending' | 'ok' | 'error'>(token ? 'pending' : 'error');
  const [message, setMessage] = useState(token ? '' : 'Liên kết không hợp lệ.');
  const started = useRef(false);
  const { status, reloadUser } = useAuth();

  useEffect(() => {
    // Token chỉ dùng được một lần => tránh gọi 2 lần khi React StrictMode chạy effect hai lần
    if (!token || started.current) return;
    started.current = true;
    api('/auth/verify-email', { body: { token }, skipRefresh: true })
      .then(() => {
        setState('ok');
        if (status === 'authenticated') void reloadUser();
      })
      .catch((err: unknown) => {
        setState('error');
        setMessage(err instanceof ApiError ? err.message : 'Xác minh thất bại');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy một lần theo token
  }, [token]);

  return (
    <AuthLayout variant="login">
      <div className="auth__form">
        <h1 className="auth__title">Xác minh email</h1>
        {state === 'pending' && (
          <p role="status" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="spinner" aria-hidden="true" /> Đang xác minh…
          </p>
        )}
        {state === 'ok' && (
          <p className="alert alert--success" role="status">
            Email của bạn đã được xác minh.
          </p>
        )}
        {state === 'error' && (
          <p className="alert alert--error" role="alert">
            {message}
          </p>
        )}
        <Link to="/home" className="btn btn--primary btn--block">
          Về trang chính
        </Link>
      </div>
    </AuthLayout>
  );
}
