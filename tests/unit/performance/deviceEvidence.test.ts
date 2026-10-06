import { expect, test } from 'vitest';
import { validateDeviceEvidence } from '../../../tools/performance/deviceEvidence';
test('E18 @E18 recording validation rejects emulation declarations, incorrect scenarios and invented summaries', () => {
  const evidence = { version: 1, physicalDevice: true, deviceClass: 'mid-range', platform: 'android', model: 'Fixture device', recordedAt: '2026-10-06T00:00:00Z', userAgent: 'Android', scenario: 'perf-l6-mainstreet', quality: 'low', backend: 'webgl', infected: 100, frameMs: Array(600).fill(20), durationMs: 12000, fpsP50: 50 };
  expect(validateDeviceEvidence(evidence)).toEqual([]);
  for (const patch of [{ physicalDevice: false }, { fpsP50: 60 }, { scenario: 'empty' }, { frameMs: [20] }, { userAgent: 'Chrome Mac' }, { durationMs: 100 }, { infected: 1 }]) expect(validateDeviceEvidence({ ...evidence, ...patch }).length).toBeGreaterThan(0);
});
