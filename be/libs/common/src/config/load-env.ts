import { config } from 'dotenv';
import { join } from 'node:path';

/**
 * Nạp biến môi trường cho một service (dùng chung cho app và TypeORM CLI).
 * Thứ tự ưu tiên: biến môi trường có sẵn > be/apps/<service>/.env > be/.env.
 * Khi dev dùng MỘT file be/.env: <SERVICE>_DATABASE_URL, <SERVICE>_PORT được map
 * sang DATABASE_URL, PORT nếu hai biến này chưa được đặt.
 */
export function loadServiceEnv(service: string, beRoot = process.cwd()): void {
  config({
    path: [join(beRoot, 'apps', service, '.env'), join(beRoot, '.env')],
    quiet: true,
  });
  process.env.SERVICE_NAME = service;
  const prefix = service.toUpperCase();
  process.env.DATABASE_URL ??= process.env[`${prefix}_DATABASE_URL`];
  process.env.PORT ??= process.env[`${prefix}_PORT`];
}
