import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  api,
  setAccessToken,
  setRefreshHandler,
  setSessionExpiredHandler,
  singleFlight,
} from '../lib/api';
import type { AuthResponse, OnboardingPayload, OnboardingResponse, User } from '../lib/types';
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context';

/** Mọi lời gọi /auth/refresh đi qua đây => không bao giờ có 2 request refresh song song. */
function refreshRequest(): Promise<AuthResponse> {
  return singleFlight('auth-refresh', () =>
    api<AuthResponse>('/auth/refresh', { method: 'POST', skipRefresh: true }),
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  const applySession = useCallback((res: { accessToken: string; user: User }) => {
    setAccessToken(res.accessToken);
    setUser(res.user);
    setStatus('authenticated');
    return res.user;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus('guest');
  }, []);

  /** Đổi refresh token (cookie) lấy access token mới. */
  const refresh = useCallback(async (): Promise<boolean> => {
    try {
      const res = await refreshRequest();
      applySession(res);
      return true;
    } catch {
      return false;
    }
  }, [applySession]);

  useEffect(() => {
    setRefreshHandler(refresh);
    setSessionExpiredHandler(clearSession);
    // Khôi phục phiên khi tải lại trang (cookie refresh token vẫn còn)
    let cancelled = false;
    refreshRequest()
      .then((res) => {
        if (!cancelled) applySession(res);
      })
      .catch(() => {
        if (!cancelled) clearSession();
      });
    return () => {
      cancelled = true;
      setRefreshHandler(null);
      setSessionExpiredHandler(null);
    };
  }, [refresh, clearSession, applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login: async (email, password) =>
        applySession(
          await api<AuthResponse>('/auth/login', { body: { email, password }, skipRefresh: true }),
        ),
      register: async (fullName, email, password) =>
        applySession(
          await api<AuthResponse>('/auth/register', {
            body: { fullName, email, password },
            skipRefresh: true,
          }),
        ),
      loginWithGoogle: async (idToken) =>
        applySession(
          await api<AuthResponse>('/auth/google', { body: { idToken }, skipRefresh: true }),
        ),
      logout: async () => {
        try {
          await api('/auth/logout', { method: 'POST', body: {}, skipRefresh: true });
        } finally {
          clearSession();
        }
      },
      completeOnboarding: async (payload: OnboardingPayload) =>
        applySession(await api<OnboardingResponse>('/users/me/onboarding', { body: payload })),
      reloadUser: async () => {
        await refresh();
      },
      resendVerification: async () => {
        await api('/auth/resend-verification', { method: 'POST', body: {} });
      },
    }),
    [status, user, applySession, clearSession, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
