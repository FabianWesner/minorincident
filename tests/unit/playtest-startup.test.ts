import { expect, test } from 'vitest';
import { preset } from '../../src/sim/progression/Campaign';
import { assertRenderedBodies, playtestSave } from '../../tools/playtest/startup';

test('#99 fists seed persists only fists and kick while retaining campaign progress', () => {
  const source = preset('L6-default'), save = playtestSave(source, 'male', 'fists');
  expect(save.racks).toEqual({ LEFT: ['weapon.fists'], RIGHT: ['weapon.kick'] });
  expect(save.ownedActions).toEqual(['weapon.fists', 'weapon.kick']);
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
