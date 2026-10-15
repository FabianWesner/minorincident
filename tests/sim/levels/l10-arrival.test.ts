import { expect, test } from 'vitest';
import { runFinaleCalibration } from '../../../tools/sim-runner/l10-finale-calibration';

for (const tier of ['high', 'low'] as const) test(`T-E32-21-E3b @E32-AC21 seed-32 rocket checkpoint route arrival ${tier}`, async () => {
  const result = await runFinaleCalibration(tier);
  expect(result.arrival).not.toBeNull();
  // E32-AC10 wins over §5.7's arrival target: cruise stays at 0.7× run.
  // Even an unobstructed straight route cannot make 40 s for this checkpoint.
  // These are the measured seed-32 times on the connected R6/R7 shortcuts.
  expect(result.arrival).toBeCloseTo(tier === 'high' ? 143.15 : 141.9667, 0);
  expect(result.fullChargeBossGate).toBe(true);
  expect(result.fullChargeBossGateText).toContain('Kill the Mega Alpha');
  expect(result.bossGatePursuitM).toBeGreaterThan(0);
  expect(result.bossIdChanged).toBe(false);
  expect(result.bossApproachStepMaxM).toBeLessThan(.25);
  expect(result.released).toBe(true);
  expect(result.deaths).toBe(0);
  expect(result.peak).toBeLessThanOrEqual(tier === 'high' ? 200 : 100);
}, 120_000);
