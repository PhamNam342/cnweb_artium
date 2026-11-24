import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { useGoogleSignIn } from '../auth/useGoogleSignIn';
import { ApiError } from '../lib/api';

/**
 * Nút Google chính thức (Google Identity Services). Không cấu hình VITE_GOOGLE_CLIENT_ID => không hiện gì,
 * để không có nút "chết" trên giao diện.
 */
export function GoogleSignIn({
  mode,
  redirectTo,
}: {
  mode: 'login' | 'register';
  redirectTo: string;
}) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const onCredential = useCallback(
    (idToken: string) => {
      setError(null);
      loginWithGoogle(idToken)
        .then(() => navigate(redirectTo, { replace: true }))
        .catch((e: unknown) =>
          setError(e instanceof ApiError ? e.message : 'Đăng nhập Google thất bại'),
        );
    },
    [loginWithGoogle, navigate, redirectTo],
  );

  const {
    ref,
    enabled,
    error: loadError,
  } = useGoogleSignIn(onCredential, mode === 'login' ? 'continue_with' : 'signup_with');
  if (!enabled) return null;

  return (
    <>
      <div ref={ref} className="google-slot" />
      {(error || loadError) && (
        <p className="alert alert--error" role="alert">
          {error ?? loadError}
        </p>
      )}
      <div className="divider">hoặc dùng email</div>
    </>
  );
}
