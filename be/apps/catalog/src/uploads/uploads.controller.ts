import type { AuthUser } from '@app/common';
import { CurrentUser, Roles, UserRole } from '@app/common';
import { CloudinaryService, UploadTicket } from '@app/storage';
import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MAX_IMAGE_BYTES, UploadTicketDto } from '../artworks/dto/artwork.dto';

@ApiTags('uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  /**
   * Cấp chữ ký để trình duyệt upload thẳng lên Cloudinary.
   * FE gửi multipart tới uploadUrl với: file, api_key, timestamp, signature, public_id, allowed_formats.
   */
  @Roles(UserRole.Seller)
  @Post('artwork-images')
  @HttpCode(200)
  artworkImages(
    @CurrentUser() user: AuthUser,
    @Body() dto: UploadTicketDto,
  ): UploadTicket & { maxBytes: number } {
    const folder = this.cloudinary.folderFor('artworks', user.id);
    return {
      ...this.cloudinary.createUploadTicket(folder, dto.count),
      maxBytes: MAX_IMAGE_BYTES,
    };
  }
}
