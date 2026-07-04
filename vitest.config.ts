import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import path from 'node:path';

const env = loadEnv('', process.cwd(), '');
Object.assign(process.env, env);

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
