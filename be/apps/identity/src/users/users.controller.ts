import type { AuthUser } from '@app/common';
import { CurrentUser, Public } from '@app/common';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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

  /** Hồ sơ công khai tối thiểu (tên, avatar) — cho service khác/FE hiển thị. */
  @Public()
  @Get(':id')
  async publicProfile(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PublicUserResponse> {
    return toPublicUserResponse(await this.users.findPublicById(id));
  }
}
