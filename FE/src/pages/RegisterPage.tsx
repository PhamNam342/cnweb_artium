import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { AuthLayout } from '../components/AuthLayout';
import { GoogleSignIn } from '../components/GoogleSignIn';
import { PasswordField } from '../components/PasswordField';
import { ApiError } from '../lib/api';
import { checkPassword } from '../lib/password';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    fullName.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    checkPassword(password).valid &&
    agreed;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      navigate('/home', { replace: true }); // popup onboarding hiện ở trang chính
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng ký thất bại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout variant="register">
      <form className="auth__form" onSubmit={onSubmit} noValidate>
        <div>
          <h1 className="auth__title">Tạo tài khoản</h1>
          <p className="auth__sub">
            Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
          </p>
        </div>

        <GoogleSignIn mode="register" redirectTo="/home" />

        <div className="field">
          <label htmlFor="reg-name" className="field__label">
            Họ và tên
          </label>
          <input
            id="reg-name"
            className="input"
            autoComplete="name"
            placeholder="Nguyễn Văn A"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="reg-email" className="field__label">
            Email
          </label>
          <input
            id="reg-email"
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
          autoComplete="new-password"
          showStrength
        />

        <label className="checkbox">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            Tôi đồng ý với <a href="#terms">Điều khoản sử dụng</a> và{' '}
            <a href="#privacy">Chính sách quyền riêng tư</a>.
          </span>
        </label>

        {error && (
          <p className="alert alert--error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="btn btn--primary btn--lg btn--block"
          disabled={!canSubmit || submitting}
        >
          {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </button>
      </form>
    </AuthLayout>
  );
}
