import { loadServiceEnv } from '@app/common/config/load-env';
import { createDataSource, InboxMessage, OutboxMessage } from '@app/database';
import { join } from 'node:path';

loadServiceEnv('commerce');

/** DataSource cho TypeORM CLI. Dùng: npm run migrate -- commerce run */
export default createDataSource({
  entities: [
    join(__dirname, '../**/*.entity.{ts,js}'),
    OutboxMessage,
    InboxMessage,
  ],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
});
