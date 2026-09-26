import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ufly/shared': path.resolve(__dirname, '../packages/shared/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.{ts,tsx}'],
    pool: 'threads',
    singleThread: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    server: {
      deps: {
        inline: ['recharts', 'd3-scale', 'd3-shape', 'd3-path', 'd3-color', 'd3-interpolate'],
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/__tests__/**'],
    },
  },
});
