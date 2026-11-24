import type { AuthUser } from '@app/common';
import { CurrentUser, Public, Roles, UserRole } from '@app/common';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateSellerProfileDto,
  ReplaceWebsitesDto,
  SetVerificationDto,
  SlugAvailabilityResponse,
  SlugQueryDto,
  UpdateSellerProfileDto,
} from './dto/seller.dto';
import { SellerProfileResponse, toSellerResponse } from './seller.mapper';
import { SellersService } from './sellers.service';

@ApiTags('sellers')
@ApiBearerAuth()
@Controller('sellers')
export class SellersController {
  constructor(private readonly sellers: SellersService) {}

  /** Trở thành người bán. Sau đó gọi /auth/refresh để access token có role seller. */
  @Post('me')
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateSellerProfileDto,
  ): Promise<SellerProfileResponse> {
    return toSellerResponse(await this.sellers.create(user.id, dto), true);
  }

  @Roles(UserRole.Seller)
  @Get('me')
  async me(@CurrentUser() user: AuthUser): Promise<SellerProfileResponse> {
    return toSellerResponse(await this.sellers.getByUserId(user.id), true);
  }

  @Roles(UserRole.Seller)
  @Patch('me')
  async update(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSellerProfileDto,
  ): Promise<SellerProfileResponse> {
    return toSellerResponse(await this.sellers.update(user.id, dto), true);
  }

  /** Thay toàn bộ danh sách website/portfolio. */
  @Roles(UserRole.Seller)
  @Put('me/websites')
  async replaceWebsites(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplaceWebsitesDto,
  ): Promise<SellerProfileResponse> {
    return toSellerResponse(
      await this.sellers.replaceWebsites(user.id, dto),
      true,
    );
  }

  @Roles(UserRole.Seller)
  @HttpCode(HttpStatus.OK)
  @Post('me/verification-request')
  async requestVerification(
    @CurrentUser() user: AuthUser,
  ): Promise<SellerProfileResponse> {
    return toSellerResponse(
      await this.sellers.requestVerification(user.id),
      true,
    );
  }

  /** Admin duyệt / từ chối xác minh người bán. */
  @Roles(UserRole.Admin)
  @Patch(':id/verification')
  async setVerification(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetVerificationDto,
  ): Promise<SellerProfileResponse> {
    return toSellerResponse(
      await this.sellers.setVerification(id, dto.status),
      false,
    );
  }

  /** Kiểm tra slug còn trống, hoặc gợi ý slug từ tên: ?slug=abc hoặc ?name=Phòng Tranh A */
  @Public()
  @Get('slug-availability')
  async slugAvailability(
    @Query() q: SlugQueryDto,
  ): Promise<SlugAvailabilityResponse> {
    return this.sellers.checkSlug(q.slug, q.name);
  }

  @Public()
  @Get(':slug')
  async bySlug(@Param('slug') slug: string): Promise<SellerProfileResponse> {
    return toSellerResponse(await this.sellers.getBySlug(slug), false);
  }
}
