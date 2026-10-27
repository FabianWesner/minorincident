import { defineConfig } from 'vitest/config';

// Test strategy: docs/qa/test-strategy.md. Budget: tools/qa/test-budget.mjs.
// default: engine logic and code shared across levels (npm test, every change).
// nightly: the full-campaign bot, perf budgets and the QA invariants (npm run test:nightly).
export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 30_000,
    restoreMocks: true,
    setupFiles: ['tests/setup/node-gltf-images.ts'],
    projects: [
      { extends: true, test: { name: 'default', include: ['tests/engine/**/*.test.ts', 'tests/shared/**/*.test.ts', 'tests/tools/**/*.test.ts'] } },
      { extends: true, test: { name: 'nightly', include: ['tests/nightly/**/*.test.ts', 'tests/qa/invariants/**/*.test.ts'], testTimeout: 1_200_000 } },
    ],
  },
});
