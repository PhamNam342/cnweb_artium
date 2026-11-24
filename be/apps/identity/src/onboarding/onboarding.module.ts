import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SellersModule } from '../sellers/sellers.module';
import { UsersModule } from '../users/users.module';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [UsersModule, SellersModule, AuthModule],
  controllers: [OnboardingController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
