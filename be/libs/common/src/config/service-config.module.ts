import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { baseEnvSchema } from './env.schema';
import { loadServiceEnv } from './load-env';

/** Nạp + validate env cho một service. Xem loadServiceEnv để biết thứ tự ưu tiên. */
@Module({})
export class ServiceConfigModule {
  static forRoot(
    service: string,
    defaultPort: number,
    extra?: Joi.PartialSchemaMap,
  ): DynamicModule {
    loadServiceEnv(service);
    return {
      module: ServiceConfigModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          cache: true,
          ignoreEnvFile: true,
          validationSchema: baseEnvSchema
            .keys({ PORT: Joi.number().port().default(defaultPort) })
            .keys(extra ?? {}),
          validationOptions: { allowUnknown: true, abortEarly: false },
        }),
      ],
    };
  }
}
