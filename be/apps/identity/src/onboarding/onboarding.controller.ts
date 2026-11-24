import type { AuthUser } from '@app/common';
import { CurrentUser } from '@app/common';
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OnboardingDto, OnboardingResponse } from './onboarding.dto';
import { OnboardingService } from './onboarding.service';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  /** Hoàn tất popup chọn vai trò lần đầu (nhà sưu tầm hoặc nghệ sĩ). Chỉ gọi được một lần. */
  @HttpCode(HttpStatus.OK)
  @Post()
  complete(
    @CurrentUser() user: AuthUser,
    @Body() dto: OnboardingDto,
  ): Promise<OnboardingResponse> {
    return this.onboarding.complete(user.id, dto);
  }
}
