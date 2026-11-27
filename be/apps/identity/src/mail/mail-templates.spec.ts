import { passwordChangeCodeEmail } from './mail-templates';

describe('passwordChangeCodeEmail', () => {
  const msg = passwordChangeCodeEmail({
    userId: 'u1',
    email: 'lan@artium.vn',
    fullName: '<b>Lan</b>',
    code: '042917',
    expiresAt: '2026-11-28T03:10:00.000Z',
  });

  it('mã nằm trong tiêu đề, HTML và bản text', () => {
    expect(msg.to).toBe('lan@artium.vn');
    expect(msg.subject).toBe('042917 là mã đổi mật khẩu Artium của bạn');
    expect(msg.html).toContain('>042917</div>');
    expect(msg.text).toContain('042917');
  });

  it('escape tên người dùng, không có nút/liên kết', () => {
    expect(msg.html).toContain('&lt;b&gt;Lan&lt;/b&gt;');
    expect(msg.html).not.toContain('<b>Lan</b>');
    expect(msg.html).not.toContain('href=');
  });

  it('giờ hết hạn theo múi giờ Việt Nam', () => {
    expect(msg.text).toContain('10:10');
  });
});
