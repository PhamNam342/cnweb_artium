import { IsInt, IsString, MaxLength, Min } from 'class-validator';

/** Kết quả Cloudinary trả về sau khi trình duyệt upload ảnh đại diện. */
export class SetAvatarDto {
  @IsString()
  @MaxLength(255)
  publicId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  /** Chữ ký trong response upload của Cloudinary */
  @IsString()
  @MaxLength(128)
  signature!: string;
}
