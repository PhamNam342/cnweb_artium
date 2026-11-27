import { Route, Routes, useParams } from 'react-router-dom';
import { GuestOnly, RequireAuth } from './auth/guards';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './pages/PasswordPages';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ArtworkPage } from './discover/ArtworkPage';
import { ArtworkEditorPage } from './artworks/ArtworkEditorPage';
import { InventoryPage } from './artworks/InventoryPage';
import { AppLayout, RequireSeller, StudioLayout } from './studio/StudioLayout';
import type { ReactNode } from 'react';

/** Đổi id => dựng lại trang sửa (không giữ state của tác phẩm trước). */
function EditArtworkRoute() {
  const { id } = useParams();
  return <ArtworkEditorPage key={id} />;
}

/** Trang sau đăng nhập dùng chung header + menu trái. */
const signedIn = (page: ReactNode) => (
  <RequireAuth>
    <AppLayout>{page}</AppLayout>
  </RequireAuth>
);

function ArtworkRoute() {
  const { id } = useParams();
  return <ArtworkPage key={id} />;
}

/** Trang quản lý của nghệ sĩ: cần đăng nhập + tài khoản seller. */
const studio = (page: ReactNode) => (
  <RequireAuth>
    <RequireSeller>
      <StudioLayout>{page}</StudioLayout>
    </RequireSeller>
  </RequireAuth>
);

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <GuestOnly>
            <LoginPage />
          </GuestOnly>
        }
      />
      <Route
        path="/register"
        element={
          <GuestOnly>
            <RegisterPage />
          </GuestOnly>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <GuestOnly>
            <ForgotPasswordPage />
          </GuestOnly>
        }
      />
      {/* Link trong email: backend tạo theo WEB_ORIGIN/reset-password và /verify-email */}
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/home"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route path="/profile" element={signedIn(<ProfilePage />)} />
      <Route path="/artworks/:id" element={signedIn(<ArtworkRoute />)} />
      <Route path="/studio/artworks" element={studio(<InventoryPage />)} />
      <Route path="/studio/artworks/new" element={studio(<ArtworkEditorPage key="new" />)} />
      <Route path="/studio/artworks/:id/edit" element={studio(<EditArtworkRoute />)} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
