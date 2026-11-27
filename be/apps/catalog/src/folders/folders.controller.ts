import type { AuthUser } from '@app/common';
import { CurrentUser, Roles, UserRole } from '@app/common';
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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateFolderDto, UpdateFolderDto } from './dto/folder.dto';
import { FoldersService } from './folders.service';

@ApiTags('folders')
@ApiBearerAuth()
@Roles(UserRole.Seller)
@Controller('folders')
export class FoldersController {
  constructor(private readonly folders: FoldersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.folders.list(user);
  }

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateFolderDto) {
    return this.folders.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folders.update(user, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    return this.folders.remove(user, id);
  }
}
