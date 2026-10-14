import { expect, test } from 'vitest';
import { runFinaleCalibration } from '../../../tools/sim-runner/l10-finale-calibration';

for (const tier of ['high', 'low'] as const) test(`T-E32-21-E3b @E32-AC21 seed-32 rocket checkpoint route arrival ${tier}`, async () => {
  const result = await runFinaleCalibration(tier);
  expect(result.arrival).not.toBeNull();
  expect(result.arrival).toBeGreaterThanOrEqual(10);
  expect(result.arrival).toBeLessThanOrEqual(40);
  expect(result.bossIdChanged).toBe(false);
  expect(result.bossApproachStepMaxM).toBeLessThan(.25);
  expect(result.released).toBe(true);
  expect(result.deaths).toBe(0);
  expect(result.peak).toBeLessThanOrEqual(tier === 'high' ? 200 : 100);
}, 120_000);
