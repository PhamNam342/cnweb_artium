import { INestApplication, Logger, Type, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

export function configureServiceApp(
  app: INestApplication,
  title: string,
): void {
  const expressApp = app as NestExpressApplication;
  expressApp.set('trust proxy', 1); // đứng sau gateway: lấy IP thật từ X-Forwarded-For
  expressApp.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();

  const config = app.get(ConfigService);
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN'),
    credentials: true,
  });

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(`Artium ${title} API`)
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('docs', app, doc);
}

/** Khởi động một service HTTP với cấu hình chuẩn (prefix /api, validation, swagger tại /docs). */
export async function bootstrapService(
  module: Type<unknown>,
  title: string,
): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(module);
  configureServiceApp(app, title);
  const port = app.get(ConfigService).getOrThrow<number>('PORT');
  await app.listen(port);
  Logger.log(
    `${title} service chạy tại http://localhost:${port} (docs: /docs)`,
    'Bootstrap',
  );
}
