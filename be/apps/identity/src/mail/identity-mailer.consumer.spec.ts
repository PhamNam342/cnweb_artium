import { EventEnvelope, IdentityEvents } from '@app/contracts';
import { InboxService } from '@app/database';
import { RabbitMqService } from '@app/messaging';
import { IdentityMailerConsumer } from './identity-mailer.consumer';
import { MailConfig } from './mail.config';
import { MailMessage, MailService } from './mail.service';
import { escapeHtml } from './mail-templates';

const config: MailConfig = {
  host: 'smtp.test',
  port: 1025,
  secure: false,
  user: '',
  pass: '',
  from: 'Artium <no-reply@artium.local>',
  consumerEnabled: true,
};

/** Inbox giả: nhớ (messageId, consumer) đã xử lý; handler lỗi thì không ghi nhận. */
class FakeInbox {
  done = new Set<string>();
  async processOnce(
    id: string,
    consumer: string,
    handler: () => Promise<void>,
  ) {
    const key = `${id}:${consumer}`;
    if (this.done.has(key)) return false;
    await handler();
    this.done.add(key);
    return true;
  }
}

function envelope(
  type: string,
  payload: Record<string, unknown>,
  id = 'msg-1',
): EventEnvelope {
  return {
    id,
    type,
    source: 'identity',
    occurredAt: new Date().toISOString(),
    payload,
  };
}

const future = () => new Date(Date.now() + 3_600_000).toISOString();

describe('IdentityMailerConsumer', () => {
  let sent: MailMessage[];
  let failTimes: number;
  let consumer: IdentityMailerConsumer;
  let inbox: FakeInbox;

  beforeEach(() => {
    sent = [];
    failTimes = 0;
    inbox = new FakeInbox();
    const mail = {
      send: (m: MailMessage) => {
        if (failTimes > 0) {
          failTimes--;
          return Promise.reject(new Error('SMTP down'));
        }
        sent.push(m);
        return Promise.resolve();
      },
    } as unknown as MailService;
    consumer = new IdentityMailerConsumer(
      {} as RabbitMqService,
      inbox as unknown as InboxService,
      mail,
      config,
    );
    consumer.sleep = () => Promise.resolve();
  });

  it('gửi email xác minh với link đúng và chỉ gửi một lần cho message trùng', async () => {
    const env = envelope(IdentityEvents.EmailVerificationRequested, {
      userId: 'u1',
      email: 'an@vidu.com',
      fullName: 'Nguyễn An',
      verifyUrl: 'http://localhost:5173/verify-email?token=abc',
      expiresAt: future(),
    });
    expect(await consumer.handle(env)).toBe(true);
    expect(await consumer.handle(env)).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({
      to: 'an@vidu.com',
      subject: 'Xác minh email tài khoản Artium',
    });
    expect(sent[0].html).toContain('verify-email?token=abc');
    expect(sent[0].text).toContain('verify-email?token=abc');
  });

  it('gửi email đặt lại mật khẩu', async () => {
    await consumer.handle(
      envelope(IdentityEvents.PasswordResetRequested, {
        userId: 'u1',
        email: 'an@vidu.com',
        fullName: 'An',
        resetUrl: 'http://localhost:5173/reset-password?token=xyz',
        expiresAt: future(),
      }),
    );
    expect(sent[0].subject).toBe('Đặt lại mật khẩu Artium');
    expect(sent[0].html).toContain('reset-password?token=xyz');
  });

  it('thử lại khi SMTP lỗi tạm thời', async () => {
    failTimes = 2;
    const ok = await consumer.handle(
      envelope(IdentityEvents.PasswordResetRequested, {
        email: 'an@vidu.com',
        fullName: 'An',
        resetUrl: 'http://x/reset-password?token=1',
        expiresAt: future(),
      }),
    );
    expect(ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it('hết lượt thử thì báo lỗi (message vào DLQ) và không ghi inbox', async () => {
    failTimes = 99;
    const env = envelope(IdentityEvents.PasswordResetRequested, {
      email: 'an@vidu.com',
      fullName: 'An',
      resetUrl: 'http://x/reset-password?token=1',
      expiresAt: future(),
    });
    await expect(consumer.handle(env)).rejects.toThrow('SMTP down');
    expect(inbox.done.size).toBe(0);
  });

  it('bỏ qua link đã hết hạn và event không liên quan', async () => {
    const expired = envelope(IdentityEvents.EmailVerificationRequested, {
      email: 'an@vidu.com',
      fullName: 'An',
      verifyUrl: 'http://x',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(await consumer.handle(expired)).toBe(false);
    expect(await consumer.handle(envelope('identity.user.updated', {}))).toBe(
      false,
    );
    expect(sent).toHaveLength(0);
  });

  it('escape tên người dùng trong HTML (chống chèn mã)', async () => {
    await consumer.handle(
      envelope(IdentityEvents.EmailVerificationRequested, {
        email: 'x@vidu.com',
        fullName: '<script>alert(1)</script>',
        verifyUrl: 'http://x/verify-email?token=1',
        expiresAt: future(),
      }),
    );
    expect(sent[0].html).not.toContain('<script>');
    expect(sent[0].html).toContain(escapeHtml('<script>alert(1)</script>'));
  });
});
