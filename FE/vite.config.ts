import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // Dev: gọi /api cùng origin, Vite chuyển tiếp tới gateway => cookie refresh token hoạt động như production.
      proxy: {
        '/api': { target: env.VITE_PROXY_TARGET || 'http://localhost:3000', changeOrigin: true },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        exclude: ['node_modules/', 'src/test/', '**/*.d.ts', '**/*.config.*'],
      },
    },
  };
});
