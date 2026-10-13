import { defineConfig } from 'vitest/config';

// Wall-clock budgets need the CPU to themselves; functional tests still use four workers.
const timingFiles = [
  'tests/sim/ai/director.test.ts',
  'tests/sim/ai/l1-perception.test.ts',
  'tests/sim/combat/balance.test.ts',
  'tests/sim/interact/integration.test.ts',
  'tests/sim/missions/perf.test.ts',
  'tests/sim/npc/campaign.test.ts',
  'tests/sim/performance/horde.test.ts',
  'tests/sim/performance/mega-moves.test.ts',
  'tests/sim/player.test.ts',
  'tests/sim/vehicles/consequences.test.ts',
  'tests/sim/weapons.test.ts',
  'tests/unit/progression/perf.test.ts',
];

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'threads',
    maxWorkers: 4,
    testTimeout: 30_000,
    restoreMocks: true,
    projects: [
      { extends: true, test: { name: 'timing', include: timingFiles, fileParallelism: false, sequence: { groupOrder: 0 } } },
      { extends: true, test: { name: 'functional', include: ['tests/unit/**/*.test.ts', 'tests/sim/**/*.test.ts', 'tests/levels/**/*.test.ts'], exclude: timingFiles, sequence: { groupOrder: 1 } } },
    ],
  },
});
