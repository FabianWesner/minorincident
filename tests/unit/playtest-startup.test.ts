import { expect, test } from 'vitest';
import { preset } from '../../src/sim/progression/Campaign';
import { validateSave } from '../../src/sim/progression/Save';
import { assertRenderedBodies, playtestSave, shouldResumePause } from '../../tools/playtest/startup';

test('#99 fists seed persists only fists and kick while retaining campaign progress', () => {
  const source = preset('L6-default'), save = playtestSave(source, 'male', 'fists');
  expect(save.racks).toEqual({ LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] });
  // Earned ownership must remain consistent with completed levels and upgrade prerequisites.
  expect(save.ownedActions).toEqual(source.ownedActions);
  expect(save.upgrades).toEqual(source.upgrades);
  expect(save.character).toBe('male');
  expect(save.unlockedLevel).toBe(6);
  expect(save.completedLevels).toBe(source.completedLevels);
  expect(source.racks.LEFT).toContain('weapon.fire-axe');
  expect(playtestSave(source, 'female', 'weapons').racks).toEqual(source.racks);
});

test('#99 an empty handover frame is valid; visible bodies still require rendered joints', () => {
  expect(() => assertRenderedBodies([])).not.toThrow();
  expect(() => assertRenderedBodies([{ drawn: false }])).not.toThrow();
  expect(() => assertRenderedBodies([{ drawn: true, joints: {} }])).not.toThrow();
  expect(() => assertRenderedBodies([{ drawn: true }])).toThrow('rendered-body observations');
});

test('#99 the fists profile satisfies the real campaign save validator', () => {
  const source = preset('L6-default');
  expect(validateSave(source)).toBe(true);
  expect(validateSave(playtestSave(source, 'male', 'fists'))).toBe(true);
});

test('#99 the input driver resumes a visible pause menu during play', () => {
  expect(shouldResumePause('pause',false)).toBe(true);
  expect(shouldResumePause('pause',true)).toBe(false);
  expect(shouldResumePause(null,false)).toBe(false);
  expect(shouldResumePause('title',false)).toBe(false);
  expect(shouldResumePause('settings',false)).toBe(false);
});
