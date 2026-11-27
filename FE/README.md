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
├── artworks/      # Kho tác phẩm + wizard đăng/sửa tác phẩm (upload Cloudinary, form, tag)
├── auth/          # AuthProvider (phiên đăng nhập), guards, Google Sign-In
├── components/    # AppHeader, AuthLayout, PasswordField, Decor (họa tiết), Avatar...
├── lib/           # api client (tự refresh khi 401), types, rule mật khẩu, slugify, danh mục
├── onboarding/    # Popup chọn vai trò lần đầu (nhà sưu tầm / nghệ sĩ)
├── pages/         # Landing, Login, Register, Quên/Đặt lại mật khẩu, Xác minh email, Home
├── studio/        # Khung trang quản lý của nghệ sĩ (menu trái) + chặn tài khoản không phải seller
└── styles/        # global.css — design token theo Figma (Inter, #0F6BFF...); studio.css
```

## Studio nghệ sĩ (Figma: "Uploading Tweak Mobile App", "Inventory")

| Đường dẫn | Trang |
| --- | --- |
| `/studio/artworks` | Kho tác phẩm: tab trạng thái, tìm kiếm, danh sách/lưới, thư mục, menu thao tác |
| `/studio/artworks/new` | Đăng tác phẩm — 3 bước: Tải ảnh → Thông tin tác phẩm → Tag |
| `/studio/artworks/:id/edit` | Sửa tác phẩm |

- Ảnh upload **thẳng lên Cloudinary** ngay khi chọn (xin chữ ký ở `POST /api/uploads/artwork-images`), có tiến độ,
  kéo thả để sắp xếp, ảnh đầu là ảnh bìa. Cần `CLOUDINARY_*` trong `be/.env`.
- Người dùng nhập theo cm/in, kg/lbs; FE đổi sang cm/kg trước khi gửi (`src/artworks/units.ts`).
- Chỉ tài khoản `role = seller` vào được studio.

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
