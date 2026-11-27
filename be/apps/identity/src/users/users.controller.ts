import type { AuthUser } from '@app/common';
import { CurrentUser, Public } from '@app/common';
import type { UploadTicket } from '@app/storage';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SetAvatarDto } from './dto/avatar.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  PublicUserResponse,
  toPublicUserResponse,
  toUserResponse,
  UserResponse,
} from './user.mapper';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  /** Thông tin tài khoản đang đăng nhập. */
  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return toUserResponse(await this.users.findFullById(user.id));
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMeDto,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.updateMe(user.id, dto));
  }

  /**
   * Bước 1 đổi ảnh đại diện: xin chữ ký để trình duyệt upload thẳng lên Cloudinary
   * (gửi multipart tới uploadUrl: file, api_key, timestamp, signature, public_id, allowed_formats).
   */
  @Post('me/avatar/upload-ticket')
  @HttpCode(200)
  avatarUploadTicket(@CurrentUser() user: AuthUser): UploadTicket {
    return this.users.avatarUploadTicket(user.id);
  }

  /** Bước 2: gửi kết quả Cloudinary trả về để gắn làm ảnh đại diện. */
  @Put('me/avatar')
  async setAvatar(
    @CurrentUser() user: AuthUser,
    @Body() dto: SetAvatarDto,
  ): Promise<UserResponse> {
    return toUserResponse(await this.users.setAvatar(user.id, dto));
  }

  @Delete('me/avatar')
  async removeAvatar(@CurrentUser() user: AuthUser): Promise<UserResponse> {
    return toUserResponse(await this.users.removeAvatar(user.id));
  }

  /** Hồ sơ công khai tối thiểu (tên, avatar) — cho service khác/FE hiển thị. */
  @Public()
  @Get(':id')
  async publicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicUserResponse> {
    return toPublicUserResponse(await this.users.findPublicById(id));
  }
}
