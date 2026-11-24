#!/usr/bin/env node
/** Chạy bản build của một app: APP=identity node scripts/start-prod.js (dùng trong Docker). */
const path = require('node:path');
const { ALL_APPS } = require('./apps');

const app = process.env.APP ?? process.argv[2];
if (!ALL_APPS.includes(app)) {
  console.error(`Thiếu/không hợp lệ APP. Chọn: ${ALL_APPS.join(', ')}`);
  process.exit(1);
}
require(path.resolve(__dirname, `../dist/apps/${app}/apps/${app}/src/main.js`));
