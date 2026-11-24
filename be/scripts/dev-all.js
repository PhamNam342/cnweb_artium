#!/usr/bin/env node
/**
 * Chạy nhiều service ở chế độ watch trong một terminal.
 *   npm run dev                      # tất cả
 *   npm run dev -- identity gateway  # chỉ một số service
 */
const { spawn } = require('node:child_process');
const path = require('node:path');
const { ALL_APPS } = require('./apps');

const apps = process.argv.slice(2).length ? process.argv.slice(2) : ALL_APPS;
const colors = [36, 33, 32, 35, 34, 31];
const nest = path.resolve(__dirname, '../node_modules/.bin/nest');
const children = apps.map((app, i) => {
  const tag = `\x1b[${colors[i % colors.length]}m[${app}]\x1b[0m `;
  const child = spawn(nest, ['start', app, '--watch', '--preserveWatchOutput'], {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    shell: process.platform === 'win32',
  });
  const pipe = (stream, out) =>
    stream.on('data', (d) =>
      d.toString().split('\n').filter(Boolean).forEach((line) => out.write(tag + line + '\n')),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => console.log(`${tag}đã dừng (code ${code})`));
  return child;
});

const stop = () => children.forEach((c) => c.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
