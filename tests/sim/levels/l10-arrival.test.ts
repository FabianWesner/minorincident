import { expect, test } from 'vitest';
import { runFinaleCalibration } from '../../../tools/sim-runner/l10-finale-calibration';

for (const tier of ['high', 'low'] as const) test(`T-E32-21-E3b @E32-AC21 seed-32 rocket checkpoint route arrival ${tier}`, async () => {
  const result = await runFinaleCalibration(tier);
  expect(result.arrival).not.toBeNull();
  // PO 2026-10-16 / E32-AC21 preserves the measured ~143 s build-up.
  expect(result.arrival).toBeGreaterThanOrEqual(135);
  expect(result.arrival).toBeLessThanOrEqual(145);
  // Low pin recalibrated 141.9667 -> 143.4833 by world-fill-l8-l10 (L10 roadside layout change, orchestrator decision 10-20; band unchanged).
  expect(result.arrival).toBeCloseTo(tier === 'high' ? 143.15 : 143.4833, 0);
  expect(result.fullChargeBossGate).toBe(true);
  expect(result.fullChargeBossGateText).toContain('Kill the Mega Alpha');
  expect(result.bossGatePursuitM).toBeGreaterThan(0);
  expect(result.bossIdChanged).toBe(false);
  expect(result.bossApproachStepMaxM).toBeLessThan(.25);
  expect(result.released).toBe(true);
  expect(result.deaths).toBe(0);
  expect(result.peak).toBeLessThanOrEqual(tier === 'high' ? 200 : 100);
}, 120_000);
