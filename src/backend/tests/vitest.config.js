import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

const root = resolve(import.meta.dirname, '../../..');

export default defineConfig({
  test: {
    name: 'backend',
    root,
    environment: 'node',
    include: ['src/backend/tests/**/*.test.js'],
    globals: true,
    setupFiles: ['./src/backend/tests/setup.js'],
  }
});
