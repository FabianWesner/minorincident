import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts', 'tests/levels/**/*.test.ts'],
    environment: 'node',
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 30_000,
    restoreMocks: true,
  },
});
