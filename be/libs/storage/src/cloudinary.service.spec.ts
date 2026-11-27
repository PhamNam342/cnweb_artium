import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryService } from './cloudinary.service';

const make = (env: Record<string, string>) =>
  new CloudinaryService({
    get: (k: string, d?: string) => env[k] ?? d,
  } as unknown as ConfigService);

describe('CloudinaryService', () => {
  const svc = make({
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: '123',
    CLOUDINARY_API_SECRET: 'secret-abc',
  });

  it('ký tham số upload với public_id do server sinh trong thư mục của seller', () => {
    const ticket = svc.createUploadTicket('artium/artworks/seller-1', 2);
    expect(ticket.uploadUrl).toBe(
      'https://api.cloudinary.com/v1_1/demo/image/upload',
    );
    expect(ticket.items).toHaveLength(2);
    const it0 = ticket.items[0];
    expect(it0.publicId).toMatch(/^artium\/artworks\/seller-1\/[0-9a-f-]{36}$/);
    // Cloudinary sẽ tính lại đúng chữ ký này từ các tham số FE gửi lên
    expect(it0.signature).toBe(
      cloudinary.utils.api_sign_request(
        {
          public_id: it0.publicId,
          timestamp: it0.timestamp,
          allowed_formats: ticket.allowedFormats,
        },
        'secret-abc',
      ),
    );
  });

  it('xác minh chữ ký trong response upload, từ chối chữ ký giả', () => {
    // Cách SDK chính thức kiểm tra (verify_api_response_signature dùng signature_version 1)
    cloudinary.config({ api_secret: 'secret-abc' });
    const real = (
      cloudinary.utils as unknown as {
        api_sign_request: (p: object, s: string, a: null, v: number) => string;
      }
    ).api_sign_request(
      { public_id: 'artium/artworks/s/x', version: 1700000000 },
      'secret-abc',
      null,
      1,
    );
    expect(
      (
        cloudinary.utils as unknown as {
          verify_api_response_signature: (
            id: string,
            v: number,
            s: string,
          ) => boolean;
        }
      ).verify_api_response_signature('artium/artworks/s/x', 1700000000, real),
    ).toBe(true);
    expect(
      svc.verifyUploadResult('artium/artworks/s/x', 1700000000, real),
    ).toBe(true);
    expect(
      svc.verifyUploadResult('artium/artworks/s/x', 1700000001, real),
    ).toBe(false);
    expect(
      svc.verifyUploadResult('artium/artworks/s/y', 1700000000, real),
    ).toBe(false);
    expect(
      svc.verifyUploadResult('artium/artworks/s/x', 1700000000, 'abc'),
    ).toBe(false);
  });

  it('sinh URL ảnh thu nhỏ qua transform Cloudinary', () => {
    expect(svc.imageUrl('artium/a/b', 5, 'thumb')).toBe(
      'https://res.cloudinary.com/demo/image/upload/c_fill,w_400,h_400,g_auto,f_auto,q_auto/v5/artium/a/b',
    );
  });

  it('đọc lại public_id từ URL ảnh của cloud này, bỏ qua URL lạ', () => {
    const url = svc.imageUrl('artium/avatars/u1/abc', 7, 'avatar');
    expect(url).toContain('/c_fill,w_256,h_256,g_face,');
    expect(svc.publicIdFromUrl(url)).toBe('artium/avatars/u1/abc');
    expect(
      svc.publicIdFromUrl('https://lh3.googleusercontent.com/a/x'),
    ).toBeNull();
    expect(svc.publicIdFromUrl(null)).toBeNull();
  });

  it('báo 503 khi chưa cấu hình', () => {
    expect(() => make({}).createUploadTicket('x', 1)).toThrow(
      'Chưa cấu hình Cloudinary',
    );
  });
});
