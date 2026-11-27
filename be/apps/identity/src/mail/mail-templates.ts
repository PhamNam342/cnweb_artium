import type {
  EmailVerificationRequestedPayload,
  PasswordChangeCodeRequestedPayload,
  PasswordResetRequestedPayload,
} from '@app/contracts';
import type { MailMessage } from './mail.service';

/** Escape dữ liệu người dùng (tên...) trước khi chèn vào HTML email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatExpiry(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Khung email đơn giản, inline style (nhiều trình đọc mail bỏ <style>). */
function layout(opts: {
  heading: string;
  intro: string;
  /** Nút + liên kết (email xác minh / đặt lại mật khẩu) */
  cta?: string;
  url?: string;
  /** Mã ngắn hiển thị to (email đổi mật khẩu) */
  code?: string;
  note: string;
}): string {
  const url = escapeHtml(opts.url ?? '');
  const action = opts.code
    ? `<tr><td style="padding-bottom:28px"><div style="display:inline-block;background:#F3F3F3;border-radius:12px;padding:16px 28px;font-size:32px;font-weight:700;letter-spacing:10px;font-family:'SFMono-Regular',Menlo,Consolas,monospace">${escapeHtml(opts.code)}</div></td></tr>`
    : `<tr><td style="padding-bottom:28px">
<a href="${url}" style="display:inline-block;background:#0F6BFF;color:#FFFFFF;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:32px">${opts.cta ?? ''}</a>
</td></tr>`;
  const fallback = opts.url
    ? `<tr><td style="font-size:12px;line-height:1.6;color:#767676;word-break:break-all">Nếu nút không hoạt động, mở liên kết sau:<br><a href="${url}" style="color:#0F6BFF">${url}</a></td></tr>`
    : '';
  return `<!doctype html>
<html lang="vi"><body style="margin:0;background:#F3F3F3;font-family:Inter,Arial,sans-serif;color:#1A1A1A">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border-radius:16px;padding:40px">
<tr><td style="font-weight:800;font-size:20px;letter-spacing:2px;padding-bottom:28px">ARTIUM</td></tr>
<tr><td style="font-size:24px;font-weight:600;padding-bottom:16px">${opts.heading}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#1A1A1A;padding-bottom:28px">${opts.intro}</td></tr>
${action}
<tr><td style="font-size:13px;line-height:1.6;color:#767676;padding-bottom:12px">${opts.note}</td></tr>
${fallback}
</table>
<p style="font-size:12px;color:#8E8E93;margin-top:20px">Email tự động từ Artium, vui lòng không trả lời.</p>
</td></tr></table>
</body></html>`;
}

export function verificationEmail(
  p: EmailVerificationRequestedPayload,
): MailMessage {
  const name = escapeHtml(p.fullName);
  const expires = formatExpiry(p.expiresAt);
  return {
    to: p.email,
    subject: 'Xác minh email tài khoản Artium',
    html: layout({
      heading: 'Xác minh email của bạn',
      intro: `Chào ${name}, cảm ơn bạn đã tham gia Artium. Bấm nút bên dưới để xác minh địa chỉ email và dùng đầy đủ tính năng mua bán.`,
      cta: 'Xác minh email',
      url: p.verifyUrl,
      note: `Liên kết có hiệu lực đến ${expires}. Nếu bạn không tạo tài khoản Artium, hãy bỏ qua email này.`,
    }),
    text: [
      `Chào ${p.fullName},`,
      '',
      'Mở liên kết sau để xác minh email tài khoản Artium:',
      p.verifyUrl,
      '',
      `Liên kết có hiệu lực đến ${expires}.`,
      'Nếu bạn không tạo tài khoản Artium, hãy bỏ qua email này.',
    ].join('\n'),
  };
}

export function passwordResetEmail(
  p: PasswordResetRequestedPayload,
): MailMessage {
  const name = escapeHtml(p.fullName);
  const expires = formatExpiry(p.expiresAt);
  return {
    to: p.email,
    subject: 'Đặt lại mật khẩu Artium',
    html: layout({
      heading: 'Đặt lại mật khẩu',
      intro: `Chào ${name}, chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn. Bấm nút bên dưới để đặt mật khẩu mới.`,
      cta: 'Đặt mật khẩu mới',
      url: p.resetUrl,
      note: `Liên kết có hiệu lực đến ${expires} và chỉ dùng được một lần. Nếu bạn không yêu cầu, hãy bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.`,
    }),
    text: [
      `Chào ${p.fullName},`,
      '',
      'Mở liên kết sau để đặt mật khẩu mới cho tài khoản Artium:',
      p.resetUrl,
      '',
      `Liên kết có hiệu lực đến ${expires} và chỉ dùng được một lần.`,
      'Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    ].join('\n'),
  };
}

export function passwordChangeCodeEmail(
  p: PasswordChangeCodeRequestedPayload,
): MailMessage {
  const name = escapeHtml(p.fullName);
  const expires = formatExpiry(p.expiresAt);
  return {
    to: p.email,
    subject: `${p.code} là mã đổi mật khẩu Artium của bạn`,
    html: layout({
      heading: 'Mã đổi mật khẩu',
      intro: `Chào ${name}, đây là mã để đổi mật khẩu tài khoản Artium. Nhập mã này trên trang Hồ sơ.`,
      code: p.code,
      note: `Mã có hiệu lực đến ${expires} và chỉ dùng được một lần. Không chia sẻ mã cho ai — Artium không bao giờ hỏi mã này. Nếu bạn không yêu cầu, hãy bỏ qua email và cân nhắc đổi mật khẩu.`,
    }),
    text: [
      `Chào ${p.fullName},`,
      '',
      `Mã đổi mật khẩu Artium của bạn: ${p.code}`,
      '',
      `Mã có hiệu lực đến ${expires} và chỉ dùng được một lần.`,
      'Không chia sẻ mã cho ai. Nếu bạn không yêu cầu, hãy bỏ qua email này.',
    ].join('\n'),
  };
}
