import { expect, test } from 'vitest';
import { backoffAdmission } from '../../../tools/browser-pool/host';

test('browser admission backs off on sustained WindowServer pressure and retains a one-context floor', () => {
  let state = { limit: 4, coolSamples: 0 };
  const limits = [61, 80, 90, 120].map(cpu => { state = backoffAdmission(state, 4, cpu); return state.limit; });
  expect(limits).toEqual([3, 2, 1, 1]);
  expect(backoffAdmission({ limit: 4, coolSamples: 2 }, 4, 60)).toEqual({ limit: 4, coolSamples: 0 });
});

test('browser admission requires three consecutive cool samples before restoring capacity', () => {
  let state = { limit: 2, coolSamples: 0 };
  const limits = [15, 15, 40, 15, 15, 15].map(cpu => { state = backoffAdmission(state, 4, cpu); return state.limit; });
  expect(limits).toEqual([2, 2, 2, 2, 2, 3]);
  for (let i = 0; i < 30; i++) state = backoffAdmission(state, 4, 0);
  expect(state.limit).toBe(4);
});

test('invalid WindowServer CPU samples reduce admission instead of restoring capacity', () => {
  for (const cpu of [NaN, Infinity, -1]) expect(backoffAdmission({ limit: 4, coolSamples: 2 }, 4, cpu)).toEqual({ limit: 1, coolSamples: 0 });
});
