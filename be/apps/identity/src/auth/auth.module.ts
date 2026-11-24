import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { UserToken } from './entities/user-token.entity';
import { GoogleVerifierService } from './google-verifier.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshToken, UserToken]), UsersModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    PasswordService,
    GoogleVerifierService,
  ],
  exports: [TokenService],
})
export class AuthModule {}
