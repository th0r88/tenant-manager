import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import react from '@vitejs/plugin-react';

const root = resolve(import.meta.dirname, '../../..');

export default defineConfig({
  plugins: [react()],
  test: {
    name: 'frontend',
    root,
    environment: 'jsdom',
    include: ['src/frontend/tests/**/*.test.{js,jsx}'],
    setupFiles: ['./src/frontend/tests/setup.js'],
    globals: true,
    css: true
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, '../')
    }
  }
});