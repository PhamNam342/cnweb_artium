#!/usr/bin/env node
/** Build mọi app (hoặc app chỉ định): npm run build [-- identity gateway] */
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { ALL_APPS } = require('./apps');

const apps = process.argv.slice(2).length ? process.argv.slice(2) : ALL_APPS;
for (const app of apps) {
  console.log(`▶ build ${app}`);
  const res = spawnSync(path.resolve(__dirname, '../node_modules/.bin/nest'), ['build', app], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (res.status !== 0) process.exit(res.status ?? 1);
}
