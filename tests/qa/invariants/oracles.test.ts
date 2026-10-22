import { describe, expect, test } from 'vitest';
import { oracle } from './oracles';

describe('invariant oracles detect deliberately broken fixtures', () => {
  test('1 accessories: glasses attached to a hat', () => expect(oracle.accessory({ attach: 'hat', offset: [0, 0, 0], tolerance: .1 })).toBe(true));
  test('2 seats: sit pose without support', () => expect(oracle.seat({ sitting: true, hasSeat: false, supported: false })).toBe(true));
  test('3 scripted actors: actor hidden before the scene exit', () => expect(oracle.actor({ inScriptedScene: true, exists: true, hidden: true })).toBe(true));
  test('4 vehicles: OBB intersects a wall', () => expect(oracle.vehicle(true)).toBe(true));
  test('5 waves: authored 18, spawned 1', () => expect(oracle.wave({ authored: 18, spawned: 1 })).toBe(true));
  test('6 objective: marker suppressed beyond the two-second deadline', () => expect(oracle.objective({ markerVisible: false, visibleAtMs: 2500 })).toBe(true));
  test('7 ground: drawn top and sim support differ by 21 cm', () => expect(oracle.ground({ drawnY: .21, simY: 0 })).toBe(true));
  test('8 load: exceeds PROD by more than both budgets', () => expect(oracle.load({ candidateMs: 3000, baselineMs: 1000 })).toBe(true));
});
