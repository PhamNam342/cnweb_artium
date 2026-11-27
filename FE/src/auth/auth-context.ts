import { createContext, useContext } from 'react';
import type { OnboardingPayload, User } from '../lib/types';

export type AuthStatus = 'loading' | 'authenticated' | 'guest';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (email: string, password: string) => Promise<User>;
  register: (fullName: string, email: string, password: string) => Promise<User>;
  loginWithGoogle: (idToken: string) => Promise<User>;
  logout: () => Promise<void>;
  completeOnboarding: (payload: OnboardingPayload) => Promise<User>;
  resendVerification: () => Promise<void>;
  /** Lấy lại thông tin user + token mới (VD: sau khi xác minh email). */
  reloadUser: () => Promise<void>;
  /** Gửi mã 6 số qua email để đổi mật khẩu. */
  requestPasswordCode: () => Promise<{ sentTo: string; expiresAt: string }>;
  /** Đổi mật khẩu bằng mã; thiết bị khác bị đăng xuất, thiết bị này nhận phiên mới. */
  changePasswordWithCode: (code: string, newPassword: string) => Promise<User>;
  /** Cập nhật thông tin user đang hiển thị (VD: sau khi đổi ảnh đại diện). */
  updateUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải dùng bên trong <AuthProvider>');
  return ctx;
}
