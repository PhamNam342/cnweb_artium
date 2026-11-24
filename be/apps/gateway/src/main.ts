import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import type { ServerResponse } from 'node:http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GatewayModule } from './gateway.module';
import { matchRoute, ROUTES } from './routes';

/**
 * API Gateway: một cổng duy nhất cho FE (http://localhost:3000/api/...).
 * Chỉ định tuyến; xác thực JWT do từng service tự làm (lib @app/common).
 * bodyParser tắt để body được chuyển nguyên vẹn (webhook PayOS cần body gốc để verify chữ ký).
 */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(GatewayModule, {
    bodyParser: false,
  });
  const config = app.get(ConfigService);
  const logger = new Logger('Gateway');

  app.set('trust proxy', 1);
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN'),
    credentials: true,
  });

  const targets = Object.fromEntries(
    ROUTES.map((r) => [
      r.service,
      config.get<string>(r.envKey) ?? r.defaultUrl,
    ]),
  );

  const proxy = createProxyMiddleware<Request, Response>({
    router: (req) => targets[matchRoute(req.originalUrl)!.service],
    changeOrigin: true,
    xfwd: true,
    on: {
      error: (err, _req, res) => {
        logger.error(`Proxy lỗi: ${err.message}`);
        const r = res as ServerResponse;
        if (!r.headersSent) {
          r.writeHead(502, { 'Content-Type': 'application/json' });
          r.end(
            JSON.stringify({
              statusCode: 502,
              message: 'Service tạm thời không khả dụng',
            }),
          );
        }
      },
    },
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path === '/api/health' || !matchRoute(req.originalUrl))
      return next();
    return proxy(req, res, next);
  });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  const port = config.get<number>('GATEWAY_PORT', 3000);
  await app.listen(port);
  logger.log(`Gateway chạy tại http://localhost:${port}/api`);
  for (const r of ROUTES)
    logger.log(`  ${r.prefixes.join(', ')} -> ${targets[r.service]}`);
}

void bootstrap();
