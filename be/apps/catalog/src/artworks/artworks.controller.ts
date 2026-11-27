import type { AuthUser } from '@app/common';
import { CurrentUser, Page, Public, Roles, UserRole } from '@app/common';
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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArtworkResponse } from './artwork.mapper';
import { ArtworksService } from './artworks.service';
import {
  InventoryQueryDto,
  PublicArtworkQueryDto,
} from './dto/artwork-query.dto';
import {
  BulkArtworkDto,
  CreateArtworkDto,
  ReplaceImagesDto,
  UpdateArtworkDto,
} from './dto/artwork.dto';

const Id = () => Param('id', new ParseUUIDPipe());

@ApiTags('artworks')
@ApiBearerAuth()
@Controller('artworks')
export class ArtworksController {
  constructor(private readonly artworks: ArtworksService) {}

  // ── Công khai ──

  @Public()
  @Get()
  list(@Query() q: PublicArtworkQueryDto): Promise<Page<ArtworkResponse>> {
    return this.artworks.listPublic(q);
  }

  // ── Kho của seller (khai báo trước :id để "mine" không bị hiểu là id) ──

  @Roles(UserRole.Seller)
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser, @Query() q: InventoryQueryDto) {
    return this.artworks.listMine(user, q);
  }

  @Roles(UserRole.Seller)
  @Get('mine/:id')
  getMine(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.artworks.getMine(user, id);
  }

  @Roles(UserRole.Seller)
  @Post('bulk')
  @HttpCode(200)
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkArtworkDto) {
    return this.artworks.bulk(user, dto);
  }

  @Public()
  @Get(':id')
  get(@Id() id: string, @CurrentUser() user?: AuthUser) {
    return this.artworks.getPublic(id, user);
  }

  @Roles(UserRole.Seller)
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateArtworkDto) {
    return this.artworks.create(user, dto);
  }

  @Roles(UserRole.Seller)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: UpdateArtworkDto,
  ) {
    return this.artworks.update(user, id, dto);
  }

  @Roles(UserRole.Seller)
  @Put(':id/images')
  replaceImages(
    @CurrentUser() user: AuthUser,
    @Id() id: string,
    @Body() dto: ReplaceImagesDto,
  ) {
    return this.artworks.replaceImages(user, id, dto.images);
  }

  @Roles(UserRole.Seller)
  @Post(':id/publish')
  @HttpCode(200)
  publish(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.artworks.publish(user, id);
  }

  @Roles(UserRole.Seller)
  @Post(':id/unpublish')
  @HttpCode(200)
  unpublish(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.artworks.unpublish(user, id);
  }

  @Roles(UserRole.Seller)
  @Post(':id/archive')
  @HttpCode(200)
  archive(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.artworks.archive(user, id);
  }

  @Roles(UserRole.Seller)
  @Post(':id/restore')
  @HttpCode(200)
  restore(@CurrentUser() user: AuthUser, @Id() id: string) {
    return this.artworks.restore(user, id);
  }

  @Roles(UserRole.Seller)
  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: AuthUser, @Id() id: string): Promise<void> {
    return this.artworks.remove(user, id);
  }
}
