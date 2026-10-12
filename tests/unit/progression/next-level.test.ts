import { describe, expect, it } from 'vitest';
import { nextLevelAfter, preset, type Level } from '../../../src/sim/progression/Campaign';

describe('next level selection', () => {
  const saves = { fresh: preset('L2-default'), l2Completed: preset('L3-default'), furthest: preset('L6-default') };
  it('finishing level N always continues with N+1, whatever the save has unlocked', () => {
    for (const [name, save] of Object.entries(saves))
      for (let n = 1; n <= 5; n++) {
        const next = nextLevelAfter(n);
        expect(next, `${name} L${n}`).toBe(n + 1);
        // never past what a finished level can load: N+1 is unlocked as soon as N is completed
        expect(next! <= save.unlockedLevel || n >= save.unlockedLevel, `${name} L${n} reachable`).toBe(true);
      }
  });
  it('L1 never hands over to L3, even when L2 is completed', () => {
    expect(saves.l2Completed.completedLevels).toBe(2);
    expect(nextLevelAfter(1)).toBe(2);
  });
  it('the last level has no next level', () => { expect(nextLevelAfter(6)).toBeNull(); expect(nextLevelAfter(0 as Level)).toBeNull(); });
});
