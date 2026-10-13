import { Loadout } from '../../../src/sim/combat/Loadout';
import { expect, test } from 'vitest';
import { preset, nextLevelAfter } from '../../../src/sim/progression/Campaign';
import { decodeSave, validateSave } from '../../../src/sim/progression/Save';
import { modifiedActions } from '../../../src/sim/progression/apply';
import { validateMission } from '../../../src/sim/missions/schema';
import { levelTenMission } from '../../../src/levels/L10/mission';
import { catalog } from '../../../src/data/actions/catalog';

test('T-E32-02 @E32 @E32-AC02 standalone preset has axe only and retains nonweapon progression', () => {
  const save = preset('L10-default');
  expect(save.ownedActions.filter(id => catalog[id].category !== 'ability')).toEqual(['weapon.fire-axe']);
  expect(save.racks).toEqual({ LEFT: ['weapon.fire-axe'], RIGHT: ['weapon.fire-axe'] });
  expect(save.upgrades).toEqual(preset('L8-default').upgrades);
  expect(validateSave(save)).toBe(true); expect(decodeSave(JSON.stringify(save)).status).toBe('ok');
  expect(nextLevelAfter(10)).toBeNull();
});
test('T-E32-05-ammo @E32 @E32-AC05 all reacquired campaign firearms are bottomless with their existing cooldowns', () => {
  const defs = modifiedActions(preset('L10-default'));
  for (const id of ['weapon.pistol','weapon.shotgun','weapon.army-mg','weapon.rocket-launcher']) {
    expect(defs[id].magazine).toBe(0); expect(defs[id].reloadTime).toBe(0);
    expect(defs[id].cooldown).toBe(catalog[id].cooldown);
  }
  const loadout = new Loadout(['weapon.fire-axe'], ['weapon.rocket-launcher'], id => defs[id], 4);
  let tick = 0;
  for (let shot = 0; shot < 10; shot++) {
    expect(loadout.usable('RIGHT', tick)).toBe(true);
    loadout.spend('RIGHT', tick, defs['weapon.rocket-launcher'], false);
    tick = loadout.current('RIGHT').readyAt + 1;
  }
  expect(loadout.current('RIGHT').reloadUntil).toBe(0);
});
test('T-E32-01-data @E32 @E32-AC01 graph validates, including when later geometry has not landed', () => {
  expect(validateMission(levelTenMission(() => ({ x: 0, z: 0, radius: 2 })))).toEqual([]);
  const partial = levelTenMission(name => name === 'cure-crash' ? { x: 0, z: 0, radius: 2 } : undefined);
  expect(validateMission(partial)).toEqual([]);
  expect(partial.steps.find(s => s.id === 'residential-fringe')!.waypoint).toBe(false);
});
test('T-E32-27-invalid @E32 @E32-AC27 malformed persisted checkpoint is rejected', () => {
  const save = preset('L10-default');
  expect(validateSave({ ...save, cureResume: { current: {}, checkpoint: {} } })).toBe(false);
});
