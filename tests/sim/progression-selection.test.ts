import { afterEach, beforeEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { applyCampaign } from '../../src/sim/progression/apply';
import { restoreSelectedAction } from '../../src/sim/progression/selection';
import { debugCampaign, newCampaign, preset } from '../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';

let world: SimWorld;
beforeEach(async () => { world = new SimWorld(); await world.init(); world.loadScenario('combat-arena'); });
afterEach(() => world.dispose());

const held = () => {
  const loadout = world.combat!.runner.loadout, side = loadout.state[loadout.state.selectedSide];
  return side.rack[side.index]?.id ?? 'weapon.fists';
};

test('Continue restores a carried weapon, otherwise chooses the best usable weapon for the L8 rack', () => {
  const carried = preset('L8-default'); carried.selectedAction = 'weapon.bat';
  applyCampaign(world, carried);
  expect(held()).toBe('weapon.bat');

  const legacy = preset('L8-default'); delete legacy.selectedAction;
  applyCampaign(world, legacy);
  expect(held()).toBe('weapon.rocket-launcher');
  expect(legacy.selectedAction).toBe('weapon.rocket-launcher');
});

test('L1-L8 handovers retain the carried weapon into the next level', () => {
  for (let level = 1; level <= 8; level++) {
    const save = preset('L8-default');
    save.completedLevels = level - 1;
    save.unlockedLevel = level as 1|2|3|4|5|6|7|8|9|10;
    save.selectedAction = 'weapon.bat';
    world.scenario = `L${level}`;
    applyCampaign(world, save);
    completeCampaignLevel(save, level as 1|2|3|4|5|6|7|8, {
      time: 0, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [],
    }, world);
    expect(save.selectedAction, `L${level} handover`).toBe('weapon.bat');
    world.scenario = `L${level + 1}`;
    applyCampaign(world, save);
    expect(held(), `L${level + 1} start`).toBe('weapon.bat');
  }
});

test('Continue skips an empty carried gun and chooses the next usable weapon before melee', () => {
  const save = newCampaign();
  save.unlockedLevel = 8; save.completedLevels = 7;
  save.ownedActions.push('weapon.bat', 'weapon.fire-axe', 'weapon.pistol');
  save.racks = { LEFT: ['weapon.bat', 'weapon.fire-axe'], RIGHT: ['weapon.pistol'] };
  save.selectedAction = 'weapon.pistol';
  applyCampaign(world, save);
  world.combat!.runner.loadout.state.RIGHT.rack[0].magazine = 0;
  save.selectedAction = restoreSelectedAction(world.combat!.runner.loadout, save);
  expect(held()).toBe('weapon.fire-axe');
});

test('level-list starts for L1-L10 restore a valid carried weapon or select the best usable boundary weapon', () => {
  const progressed = preset('L8-default'); progressed.selectedAction = 'weapon.bat';
  for (let level = 1; level <= 10; level++) {
    world.scenario = `L${level}`;
    const save = debugCampaign(level as 1|2|3|4|5|6|7|8|9|10, progressed);
    applyCampaign(world, save);
    expect(held(), `L${level} level-list start`).toBe(level === 1 ? 'weapon.fists' : level === 10 ? 'weapon.fire-axe' : 'weapon.bat');
  }
});

test('level-list starts for L1-L10 with a progressed old save choose the best usable boundary weapon', () => {
  const progressed = preset('L8-default');
  const expected = ['weapon.fists', 'weapon.bat', 'weapon.fire-axe', 'weapon.handgun', 'weapon.army-mg', 'weapon.army-mg', 'weapon.shotgun', 'weapon.rocket-launcher', 'weapon.rocket-launcher', 'weapon.fire-axe'];
  for (let level = 1; level <= 10; level++) {
    world.scenario = `L${level}`;
    const save = debugCampaign(level as 1|2|3|4|5|6|7|8|9|10, progressed);
    applyCampaign(world, save);
    expect(held(), `L${level} legacy level-list start`).toBe(expected[level - 1]);
  }
});
