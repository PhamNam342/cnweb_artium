import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

export interface DatabaseModuleOptions {
  /** Glob tới migration đã biên dịch của app, VD: [__dirname + '/database/migrations/*.{ts,js}'] */
  migrations: string[];
}

/** Kết nối tới database RIÊNG của service (DATABASE_URL). Không bao giờ synchronize. */
@Module({})
export class DatabaseModule {
  static forRoot(options: DatabaseModuleOptions): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres' as const,
            url: config.getOrThrow<string>('DATABASE_URL'),
            autoLoadEntities: true,
            synchronize: false,
            migrations: options.migrations,
            migrationsTableName: 'typeorm_migrations',
            migrationsRun: config.get<string>('DB_MIGRATIONS_RUN') === 'true',
            logging:
              config.get<string>('DB_LOGGING') === 'true'
                ? 'all'
                : ['error', 'warn'],
            retryAttempts: 10,
            retryDelay: 3000,
          }),
        }),
      ],
    };
  }
}
