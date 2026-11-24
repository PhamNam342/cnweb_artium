#!/usr/bin/env node
/**
 * Chạy migration TypeORM cho từng service.
 *   npm run migrate -- all run            # chạy migration mọi service
 *   npm run migrate -- identity run       # một service
 *   npm run migrate -- identity revert    # hoàn tác migration gần nhất
 *   npm run migrate -- identity show      # xem trạng thái
 *   npm run migrate -- identity generate AddArtworks   # sinh migration từ thay đổi entity
 */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { DB_APPS } = require('./apps');

const [target = 'all', action = 'run', name] = process.argv.slice(2);
const apps = target === 'all' ? DB_APPS : [target];
const root = path.resolve(__dirname, '..');

for (const app of apps) {
  if (!DB_APPS.includes(app)) {
    console.error(`Service không hợp lệ: ${app}. Chọn: ${DB_APPS.join(', ')} hoặc all`);
    process.exit(1);
  }
  const ds = `apps/${app}/src/database/data-source.ts`;
  const cmd = {
    run: ['migration:run', '-d', ds],
    revert: ['migration:revert', '-d', ds],
    show: ['migration:show', '-d', ds],
    generate: ['migration:generate', `apps/${app}/src/database/migrations/${name ?? 'Change'}`, '-d', ds, '--pretty'],
  }[action];
  if (!cmd) {
    console.error(`Hành động không hợp lệ: ${action} (run | revert | show | generate)`);
    process.exit(1);
  }
  console.log(`\n▶ [${app}] ${cmd[0]}`);
  const res = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', '-r', 'tsconfig-paths/register', 'node_modules/typeorm/cli.js', ...cmd],
    { cwd: root, stdio: 'inherit', env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.json' } },
  );
  if (res.status !== 0) process.exit(res.status ?? 1);
}
