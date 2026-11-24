import { useEffect, useRef, useState } from 'react';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize: (config: {
    client_id: string;
    callback: (res: GoogleCredentialResponse) => void;
    ux_mode?: 'popup';
  }) => void;
  renderButton: (el: HTMLElement, options: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error('Không tải được Google Sign-In'));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';

/**
 * Vẽ nút "Sign in with Google" chính thức vào phần tử ref.
 * Google trả về ID token (credential) => gửi cho backend POST /auth/google.
 */
export function useGoogleSignIn(
  onCredential: (idToken: string) => void,
  text: 'signin_with' | 'signup_with' | 'continue_with',
) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    cb.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (res) => cb.current(res.credential),
          ux_mode: 'popup',
        });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text,
          width: ref.current.clientWidth || 400,
          locale: 'vi',
        });
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [text]);

  return { ref, enabled: Boolean(GOOGLE_CLIENT_ID), error };
}
