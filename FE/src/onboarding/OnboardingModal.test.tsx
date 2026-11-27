import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import type { OnboardingPayload, User } from '../lib/types';
import { OnboardingModal } from './OnboardingModal';

const user: User = {
  id: 'u1',
  email: 'an@vidu.com',
  fullName: 'Nguyễn Văn An',
  avatarUrl: null,
  phone: null,
  role: 'collector',
  status: 'active',
  emailVerified: false,
  city: null,
  interests: [],
  onboardingCompleted: false,
  hasPassword: true,
  linkedProviders: [],
  sellerSlug: null,
  createdAt: '2026-11-16T00:00:00Z',
};

function renderModal(completeOnboarding: (p: OnboardingPayload) => Promise<User>) {
  const value = { completeOnboarding } as unknown as AuthContextValue;
  return render(
    <AuthContext.Provider value={value}>
      <OnboardingModal user={user} />
    </AuthContext.Provider>,
  );
}

describe('OnboardingModal', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        const slug = new URL(url).searchParams.get('slug') ?? '';
        return Promise.resolve(
          new Response(JSON.stringify({ slug, available: slug !== 'da-co' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('là popup không có nút đóng, mặc định chọn nhà sưu tầm', () => {
    renderModal(vi.fn());
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.queryByRole('button', { name: /đóng/i })).toBeNull();
    expect(screen.getByRole('radio', { name: /Nhà sưu tầm/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('nhà sưu tầm: gửi thông tin cơ bản và sở thích', async () => {
    const complete = vi.fn((p: OnboardingPayload) =>
      Promise.resolve({ ...user, ...p } as unknown as User),
    );
    renderModal(complete);
    const u = userEvent.setup();

    await u.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(screen.getByRole('heading', { name: 'Hoàn thiện hồ sơ của bạn' })).toBeInTheDocument();

    await u.type(screen.getByLabelText(/Tỉnh \/ thành phố/), 'Hà Nội');
    await u.click(screen.getByRole('button', { name: 'Nhiếp ảnh' }));
    await u.click(screen.getByRole('button', { name: /Hoàn tất/ }));

    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(complete.mock.calls[0][0]).toMatchObject({
      role: 'collector',
      fullName: 'Nguyễn Văn An',
      city: 'Hà Nội',
      interests: ['nhiep-anh'],
    });
  });

  it('chặn số điện thoại sai định dạng', async () => {
    renderModal(vi.fn());
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await u.type(screen.getByLabelText(/Số điện thoại/), '12345');
    expect(screen.getByText('Số điện thoại không hợp lệ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hoàn tất/ })).toBeDisabled();
  });

  it('nghệ sĩ: slug tự sinh, kiểm tra trùng, bỏ qua bước liên kết vẫn gửi hồ sơ', async () => {
    const complete = vi.fn((p: OnboardingPayload) =>
      Promise.resolve({ ...user, ...p } as unknown as User),
    );
    renderModal(complete);
    const u = userEvent.setup();

    await u.click(screen.getByRole('radio', { name: /Nghệ sĩ/ }));
    await u.click(screen.getByRole('button', { name: 'Tiếp tục' }));

    const display = screen.getByLabelText('Tên hiển thị trên trang nghệ sĩ');
    await u.clear(display);
    await u.type(display, 'Xưởng Gốm Bát Tràng');
    expect(screen.getByLabelText('Đường dẫn trang')).toHaveValue('xuong-gom-bat-trang');
    await screen.findByText('✓ Còn trống');

    await u.click(screen.getByRole('radio', { name: 'Gallery' }));
    await u.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(screen.getByRole('heading', { name: 'Kết nối kênh của bạn' })).toBeInTheDocument();

    await u.click(screen.getByRole('button', { name: 'Bỏ qua' }));
    await waitFor(() => expect(complete).toHaveBeenCalledTimes(1));
    expect(complete.mock.calls[0][0]).toMatchObject({
      role: 'artist',
      seller: {
        displayName: 'Xưởng Gốm Bát Tràng',
        slug: 'xuong-gom-bat-trang',
        profileType: 'gallery',
      },
    });
  });

  it('nghệ sĩ: slug đã có người dùng thì không cho tiếp tục', async () => {
    renderModal(vi.fn());
    const u = userEvent.setup();
    await u.click(screen.getByRole('radio', { name: /Nghệ sĩ/ }));
    await u.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    const slugInput = screen.getByLabelText('Đường dẫn trang');
    await u.clear(slugInput);
    await u.type(slugInput, 'da-co');
    await waitFor(() => expect(slugInput).toHaveAttribute('aria-invalid', 'true'));
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeDisabled();
  });
});
