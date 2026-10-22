import { describe, expect, test } from 'vitest';
import { oracle, obbHitsAabb } from './oracles';

// The proof command changes exactly one fixture and expects that test to exit red.
// Ordinary runs use the good fixture and also assert that the broken twin is rejected.
const broken = process.env.QA_INVARIANTS_BREAK_FIXTURE;
const fixtures = [
  { id: 'accessories', good: () => oracle.accessory({ attach: 'head', offset: [0, 0, 0], tolerance: .002 }), bad: () => oracle.accessory({ attach: 'hat', offset: [0, .4, 0], tolerance: .002 }) },
  { id: 'seats', good: () => oracle.seat({ sitting: true, hasSeat: true, supported: true }), bad: () => oracle.seat({ sitting: true, hasSeat: false, supported: false }) },
  { id: 'actors', good: () => oracle.actor({ inScriptedScene: true, exists: true, hidden: false }), bad: () => oracle.actor({ inScriptedScene: true, exists: true, hidden: true }) },
  { id: 'vehicles', good: () => obbHitsAabb(5, 0, .4, 1, .5, 0, 2, { min: [-1, 0, -1], max: [1, 2, 1] }), bad: () => obbHitsAabb(.2, 0, .4, 1, .5, 0, 2, { min: [-1, 0, -1], max: [1, 2, 1] }) },
  { id: 'waves', good: () => oracle.wave({ authored: 18, spawned: 18 }), bad: () => oracle.wave({ authored: 18, spawned: 1 }) },
  { id: 'objectives', good: () => oracle.objective({ markerVisible: true, visibleAtMs: 2000 }), bad: () => oracle.objective({ markerVisible: false, visibleAtMs: 2500 }) },
  { id: 'ground', good: () => oracle.ground({ drawnY: .2, simY: 0 }), bad: () => oracle.ground({ drawnY: .21, simY: 0 }) },
  { id: 'load', good: () => oracle.load({ candidateMs: 1100, baselineMs: 1000 }), bad: () => oracle.load({ candidateMs: 1110, baselineMs: 1000 }) },
];
describe('invariant proof fixtures', () => {
  for (const f of fixtures) test(`fixture ${f.id}`, () => {
    expect((broken === f.id ? f.bad : f.good)(), `${f.id} invariant fixture`).toBe(false);
    expect(f.bad(), `${f.id} broken twin must be rejected`).toBe(true);
  });
  test('load rejects either budget independently', () => {
    expect(oracle.load({ candidateMs: 21001, baselineMs: 20000 })).toBe(true);
    expect(oracle.load({ candidateMs: 1099, baselineMs: 1000 })).toBe(false);
  });
  test('missing or non-finite measurements fail closed', () => {
    expect(oracle.load({ candidateMs: NaN, baselineMs: 1000 })).toBe(true);
    expect(oracle.load({ candidateMs: 1000, baselineMs: 0 })).toBe(true);
    expect(oracle.ground({ drawnY: 0, simY: NaN })).toBe(true);
    expect(oracle.objective({ markerVisible: true, visibleAtMs: NaN })).toBe(true);
  });
});
