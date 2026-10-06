import { describe, test } from 'vitest';

/** Lane C. Empty scaffold (lane L0): the owning lane replaces each todo with a real test and keeps the tags. */
describe('L1 v2 infected perception', () => {
  test.todo('T-E19-08 @E19 @E19-AC08 vision cone 90 deg, 16 m, LOS incl. gates and car-wash curtain, no player hearing');
  test.todo('T-E19-09 @E19 @E19-AC09 closest visible target with 1.5 m hysteresis');
  test.todo('T-E19-10 @E19 @E19-AC10 search 10-18 s, probe points, double-back, then wander');
  test.todo('T-E19-11 @E19 @E19-AC11 car alarm attracts non-chasing infected within 30 m; 20 s, re-arm 30 s');
  test.todo('T-E19-12 @E19 @E19-AC12 speed tiers ordered and faster than the running player, jitter per entity');
});
