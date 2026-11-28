import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { UNKNOWN_USER_NAME } from './types';
import { UserChip } from './UserChip';

describe('UserChip', () => {
  it('hiện tên, chữ cái đầu khi không có avatar, và dòng phụ', () => {
    render(<UserChip user={{ fullName: 'Nguyễn Thị Lan', avatarUrl: null }} meta="3 phút trước" />);
    expect(screen.getByText('Nguyễn Thị Lan')).toBeInTheDocument();
    expect(screen.getByText('TL')).toBeInTheDocument();
    expect(screen.getByText('3 phút trước')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('thiếu thông tin người dùng thì hiện tên mặc định', () => {
    render(<UserChip user={null} />);
    expect(screen.getByText(UNKNOWN_USER_NAME)).toBeInTheDocument();
  });

  it('có `to` thì là liên kết', () => {
    render(
      <MemoryRouter>
        <UserChip user={{ fullName: 'Lan', avatarUrl: 'https://img/a.jpg' }} to="/artists/lan" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link')).toHaveAttribute('href', '/artists/lan');
  });
});
