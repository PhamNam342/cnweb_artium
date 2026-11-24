import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignIn } from '../components/GoogleSignIn';
import { PasswordField } from '../components/PasswordField';
import { ApiError } from '../lib/api';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/home';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout variant="login">
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <div>
          <h1 className="auth__title">Đăng nhập</h1>
          <p className="auth__sub">
            Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
          </p>
        </div>

        <GoogleSignIn mode="login" redirectTo={redirectTo} />

        <div className="field">
          <label htmlFor="login-email" className="field__label">
            Email
          </label>
          <input
            id="login-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="ban@vidu.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <PasswordField
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          labelAside={
            <Link to="/forgot-password" style={{ fontSize: 14 }}>
              Quên mật khẩu?
            </Link>
          }
        />

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={submitting || !email || !password}
        >
          {submitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>

        <p className="legal">
          Phiên đăng nhập được giữ bằng cookie httpOnly. Dùng máy chung? Hãy đăng xuất khi xong.
        </p>
      </form>
    </AuthLayout>
  );
}
