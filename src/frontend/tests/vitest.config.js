import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/frontend/tests/setup.js'],
    globals: true,
    css: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../')
    }
  }
});