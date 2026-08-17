import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': root,
    },
  },
  test: {
    environment: 'jsdom',
    testTimeout: 15_000,
    hookTimeout: 15_000,
    include: ['src/**/*.test.{ts,tsx}', 'routes/**/*.test.{ts,tsx}', 'lib/**/*.test.{ts,tsx}', 'scripts/**/*.test.{ts,tsx}'],
    pool: 'forks',
  },
});
