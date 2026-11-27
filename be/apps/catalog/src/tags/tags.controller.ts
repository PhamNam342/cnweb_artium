import type { AuthUser } from '@app/common';
import { CurrentUser, Public, Roles, UserRole } from '@app/common';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTagDto, TagQueryDto } from './dto/tag.dto';
import { TagsService } from './tags.service';

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  /** Công khai: tag hệ thống. Nếu là seller đã đăng nhập: kèm tag riêng. */
  @Public()
  @Get()
  list(@Query() q: TagQueryDto, @CurrentUser() user?: AuthUser) {
    return this.tags.list(q, user);
  }

  @Roles(UserRole.Seller)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTagDto) {
    return this.tags.create(user, dto);
  }
}
