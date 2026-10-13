import { describe, expect, it } from 'vitest';
import { validateSave } from '../../../src/sim/progression/Save';
import { lastLevel, nextLevelAfter, preset, type Level } from '../../../src/sim/progression/Campaign';

describe('next level selection', () => {
  const saves = { fresh: preset('L2-default'), l2Completed: preset('L3-default'), furthest: preset('L6-default') };
  it('finishing level N always continues with N+1, whatever the save has unlocked', () => {
    for (const [name, save] of Object.entries(saves))
      for (let n = 1; n <= 8; n++) {
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
  it.each([[6, 7], [7, 8], [8, 9]])('L%i continues with L%i (L6 -> L7 -> L8 -> L9 in order)', (finished, next) => { expect(nextLevelAfter(finished)).toBe(next); });
  it('L9 continues to L10; L10 is the last level; nothing precedes L1', () => {
    expect(nextLevelAfter(9)).toBe(10); expect(nextLevelAfter(10)).toBeNull(); expect(nextLevelAfter(0 as Level)).toBeNull();
    expect(lastLevel).toBe(10);
  });
  it('finishing L6 or L7 unlocks the next level so the direct handover is never locked', async () => {
    const { completeCampaignLevel } = await import('../../../src/sim/progression/carryover');
    for (const finished of [6, 7] as const) {
      const save = preset(finished === 6 ? 'L6-default' : 'L6-default'); save.completedLevels = finished - 1; save.unlockedLevel = finished as Level;
      const world = { entities: { get: () => ({ weapons: { LEFT: { rack: [{ id: 'weapon.bat' }] }, RIGHT: { rack: [{ id: 'weapon.rocket-launcher' }] } } }) } } as never;
      completeCampaignLevel(save, finished, { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] }, world);
      expect(save.completedLevels).toBe(finished); expect(save.unlockedLevel).toBe(finished + 1);
      expect(save.unlockedLevel).toBeGreaterThanOrEqual(nextLevelAfter(finished)!);
      expect(validateSave(save)).toBe(true);
    }
  });
});
