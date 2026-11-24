# Artium Frontend (React + Vite)

## Chạy dev

```bash
cp .env.example .env     # điền VITE_GOOGLE_CLIENT_ID nếu dùng đăng nhập Google
npm install
npm run dev              # http://localhost:5173 — /api được proxy tới gateway :3000
```

Cần backend đang chạy (`npm run dev:be` ở thư mục gốc). Gọi API cùng origin qua proxy nên cookie
refresh token hoạt động giống production (nginx cũng proxy `/api` tới gateway).

## Cấu trúc

```
src/
├── auth/          # AuthProvider (phiên đăng nhập), guards, Google Sign-In
├── components/    # AuthLayout, PasswordField, Decor (họa tiết), Avatar...
├── lib/           # api client (tự refresh khi 401), types, rule mật khẩu, slugify, danh mục
├── onboarding/    # Popup chọn vai trò lần đầu (nhà sưu tầm / nghệ sĩ)
├── pages/         # Landing, Login, Register, Quên/Đặt lại mật khẩu, Xác minh email, Home
└── styles/        # global.css — design token theo Figma (Inter, #0F6BFF...)
```

## Luồng đăng nhập

- Access token chỉ giữ trong bộ nhớ; refresh token là cookie httpOnly do backend đặt.
- Tải lại trang => `POST /api/auth/refresh` để khôi phục phiên. Mọi lời gọi refresh đi qua `singleFlight`
  để không bao giờ có 2 request song song (refresh token xoay vòng).
- `user.onboardingCompleted === false` => trang `/home` hiện popup onboarding không đóng được.

## Lệnh

| Lệnh | Tác dụng |
| --- | --- |
| `npm run dev` | Chạy dev server |
| `npm test` | Unit/component test (Vitest + Testing Library) |
| `npm run lint` / `npm run typecheck` | Kiểm tra code |
| `npm run build` | Build production vào `dist/` |
