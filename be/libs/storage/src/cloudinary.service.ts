import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

/** Định dạng ảnh cho phép tải lên (HEIC từ iPhone: Cloudinary tự chuyển khi hiển thị). */
export const ALLOWED_IMAGE_FORMATS = [
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'heic',
];

export interface SignedUpload {
  publicId: string;
  timestamp: number;
  signature: string;
}

export interface UploadTicket {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  allowedFormats: string;
  /** Chữ ký Cloudinary hết hạn sau 1 giờ kể từ timestamp. */
  expiresAt: string;
  items: SignedUpload[];
}

export type ImageVariant = 'thumb' | 'medium' | 'full' | 'avatar';

const TRANSFORMS: Record<ImageVariant, string> = {
  thumb: 'c_fill,w_400,h_400,g_auto,f_auto,q_auto',
  medium: 'c_limit,w_1200,f_auto,q_auto',
  full: 'c_limit,w_2400,f_auto,q_auto',
  /** Vuông 256px, ưu tiên khuôn mặt ở giữa */
  avatar: 'c_fill,w_256,h_256,g_face,f_auto,q_auto',
};

/**
 * Upload ảnh trực tiếp từ trình duyệt lên Cloudinary, backend chỉ ký tham số:
 * 1. createUploadTicket(): sinh public_id do server quyết định (trong thư mục của seller) + chữ ký.
 * 2. Trình duyệt POST file + tham số đã ký tới uploadUrl.
 * 3. Cloudinary trả {public_id, version, signature}; backend gọi verifyUploadResult() trước khi lưu.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly cloudName: string;
  private readonly apiKey: string;
  private readonly apiSecret: string;
  readonly rootFolder: string;

  constructor(config: ConfigService) {
    this.cloudName = config.get<string>('CLOUDINARY_CLOUD_NAME', '');
    this.apiKey = config.get<string>('CLOUDINARY_API_KEY', '');
    this.apiSecret = config.get<string>('CLOUDINARY_API_SECRET', '');
    this.rootFolder = config.get<string>('CLOUDINARY_FOLDER', 'artium');
    if (this.configured) {
      // Cấu hình chung của SDK, dùng cho uploader.destroy()
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
        secure: true,
      });
    }
  }

  get configured(): boolean {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret);
  }

  private assertConfigured(): void {
    if (!this.configured) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME / API_KEY / API_SECRET)',
      );
    }
  }

  /** Thư mục riêng cho mỗi seller, VD: artium/artworks/<sellerId> */
  folderFor(kind: string, ownerId: string): string {
    return `${this.rootFolder}/${kind}/${ownerId}`;
  }

  createUploadTicket(folder: string, count: number): UploadTicket {
    this.assertConfigured();
    const timestamp = Math.floor(Date.now() / 1000);
    const allowedFormats = ALLOWED_IMAGE_FORMATS.join(',');
    const items = Array.from({ length: count }, () => {
      const publicId = `${folder}/${randomUUID()}`;
      const signature = cloudinary.utils.api_sign_request(
        { public_id: publicId, timestamp, allowed_formats: allowedFormats },
        this.apiSecret,
      );
      return { publicId, timestamp, signature };
    });
    return {
      cloudName: this.cloudName,
      apiKey: this.apiKey,
      uploadUrl: `https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`,
      allowedFormats,
      expiresAt: new Date((timestamp + 3600) * 1000).toISOString(),
      items,
    };
  }

  /**
   * Chữ ký trong response upload của Cloudinary = sha1("public_id=<id>&version=<v>" + api_secret)
   * (giống cloudinary.utils.verify_api_response_signature, signature_version 1).
   */
  verifyUploadResult(
    publicId: string,
    version: number,
    signature: string,
  ): boolean {
    this.assertConfigured();
    const expected = createHash('sha1')
      .update(`public_id=${publicId}&version=${version}${this.apiSecret}`)
      .digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature ?? '');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  imageUrl(
    publicId: string,
    version: number,
    variant: ImageVariant = 'medium',
  ): string {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${TRANSFORMS[variant]}/v${version}/${publicId}`;
  }

  /**
   * Lấy public_id từ URL do imageUrl() sinh ra (chỉ URL thuộc cloud này).
   * Dùng khi DB chỉ lưu URL (VD: users.avatar_url) mà cần xóa ảnh cũ.
   */
  publicIdFromUrl(url: string | null | undefined): string | null {
    if (!url || !this.cloudName) return null;
    const prefix = `https://res.cloudinary.com/${this.cloudName}/image/upload/`;
    if (!url.startsWith(prefix)) return null;
    const m = url.slice(prefix.length).match(/(?:^|\/)v\d+\/(.+)$/);
    return m ? m[1] : null;
  }

  /** Xóa ảnh khỏi Cloudinary — best effort (lỗi chỉ ghi log, không làm hỏng request). */
  async destroy(publicIds: string[]): Promise<void> {
    if (!this.configured || publicIds.length === 0) return;
    await Promise.all(
      publicIds.map(async (id) => {
        try {
          await cloudinary.uploader.destroy(id, { invalidate: true });
        } catch (err) {
          this.logger.warn(
            `Không xóa được ảnh ${id}: ${(err as Error).message}`,
          );
        }
      }),
    );
  }
}
