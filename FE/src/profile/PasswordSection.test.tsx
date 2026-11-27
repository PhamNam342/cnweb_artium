import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext, type AuthContextValue } from '../auth/auth-context';
import { ApiError } from '../lib/api';
import type { User } from '../lib/types';
import { PasswordSection } from './PasswordSection';

const user = { id: 'u1', fullName: 'Lan', email: 'lan@artium.vn', hasPassword: true } as User;

function setup(over: Partial<AuthContextValue> = {}) {
  const value = {
    user,
    requestPasswordCode: vi.fn().mockResolvedValue({ sentTo: 'la••@artium.vn', expiresAt: '' }),
    changePasswordWithCode: vi.fn().mockResolvedValue(user),
    ...over,
  } as unknown as AuthContextValue;
  render(
    <AuthContext.Provider value={value}>
      <PasswordSection />
    </AuthContext.Provider>,
  );
  return value;
}

describe('PasswordSection', () => {
  it('gửi mã → hiện form nhập mã, đếm ngược gửi lại', async () => {
    const ctx = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(ctx.requestPasswordCode).toHaveBeenCalled();
    expect(await screen.findByText('la••@artium.vn')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Gửi lại sau \d+s/ })).toBeDisabled();
  });

  it('kiểm tra mã 6 số, mật khẩu mạnh, nhập lại khớp trước khi gửi', async () => {
    const ctx = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await screen.findByLabelText('Mã xác nhận');
    await userEvent.type(screen.getByLabelText('Mã xác nhận'), '12a3');
    expect(screen.getByLabelText('Mã xác nhận')).toHaveValue('123');
    await userEvent.type(screen.getByLabelText('Mật khẩu mới'), 'ngan');
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'khac');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(screen.getByText('Nhập đủ 6 chữ số trong email')).toBeInTheDocument();
    expect(screen.getByText('Mật khẩu nhập lại không khớp')).toBeInTheDocument();
    expect(ctx.changePasswordWithCode).not.toHaveBeenCalled();
  });

  it('đổi thành công; lỗi sai mã hiện dưới ô mã', async () => {
    const changePasswordWithCode = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(400, 'Mã không đúng — còn 4 lần thử', []))
      .mockResolvedValueOnce(user);
    setup({ changePasswordWithCode });
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await userEvent.type(await screen.findByLabelText('Mã xác nhận'), '123456');
    await userEvent.type(screen.getByLabelText('Mật khẩu mới'), 'MatKhauMoi1');
    await userEvent.type(screen.getByLabelText('Nhập lại mật khẩu mới'), 'MatKhauMoi1');
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    expect(await screen.findByText('Mã không đúng — còn 4 lần thử')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Đổi mật khẩu' }));
    await waitFor(() =>
      expect(screen.getByText(/Đã đổi mật khẩu\. Các thiết bị khác/)).toBeInTheDocument(),
    );
    expect(changePasswordWithCode).toHaveBeenLastCalledWith('123456', 'MatKhauMoi1');
  });

  it('tài khoản Google chưa có mật khẩu: nút "Đặt mật khẩu"', () => {
    setup({ user: { ...user, hasPassword: false } });
    expect(screen.getByRole('button', { name: 'Đặt mật khẩu' })).toBeInTheDocument();
  });
});
