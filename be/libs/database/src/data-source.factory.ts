import 'reflect-metadata';
import { DataSource, DataSourceOptions } from 'typeorm';

/** DataSource cho TypeORM CLI (migration). Mỗi app gọi hàm này trong database/data-source.ts. */
export function createDataSource(options: {
  entities: DataSourceOptions['entities'];
  migrations: string[];
}): DataSource {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu DATABASE_URL');
  return new DataSource({
    type: 'postgres',
    url,
    synchronize: false,
    entities: options.entities,
    migrations: options.migrations,
    migrationsTableName: 'typeorm_migrations',
  });
}
