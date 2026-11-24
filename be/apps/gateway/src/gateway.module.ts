import { Controller, Get, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { join } from 'node:path';
import { ROUTES } from './routes';

@Controller('health')
class GatewayHealthController {
  /** Kiểm tra sức khỏe gateway + từng service phía sau. */
  @Get()
  async check() {
    const services = await Promise.all(
      ROUTES.map(async (r) => {
        const url = process.env[r.envKey] ?? r.defaultUrl;
        try {
          const res = await fetch(`${url}/api/health`, {
            signal: AbortSignal.timeout(2000),
          });
          return [r.service, res.ok ? 'up' : 'down'] as const;
        } catch {
          return [r.service, 'down'] as const;
        }
      }),
    );
    return { status: 'ok', services: Object.fromEntries(services) };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), 'apps/gateway/.env'),
        join(process.cwd(), '.env'),
      ],
      validationSchema: Joi.object({
        GATEWAY_PORT: Joi.number().port().default(3000),
        WEB_ORIGIN: Joi.string().default('http://localhost:5173'),
      }),
      validationOptions: { allowUnknown: true },
    }),
  ],
  controllers: [GatewayHealthController],
})
export class GatewayModule {}
