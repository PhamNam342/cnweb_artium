import { Global, Module } from '@nestjs/common';
import {
  identityConfigProvider,
  IDENTITY_CONFIG,
} from './identity-config.provider';

@Global()
@Module({ providers: [identityConfigProvider], exports: [IDENTITY_CONFIG] })
export class IdentityConfigModule {}
