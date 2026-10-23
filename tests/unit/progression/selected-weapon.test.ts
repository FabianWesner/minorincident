import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Game } from '../../../src/Game';
import { emptyInput } from '../../../src/input/InputFrame';
import { weaponKey } from '../../../src/data/weaponKeys';
import { compositions } from '../../../src/levels/compositions';
import { resolveCampaignMission } from '../../../src/levels/missions';
import { debugCampaign, type CampaignSave, type Level } from '../../../src/sim/progression/Campaign';
import { applyCampaign } from '../../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { decodeSave, SaveStore, validateSave } from '../../../src/sim/progression/Save';
import { SimWorld } from '../../../src/sim/world/SimWorld';

const result = { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] };
let world: SimWorld;
beforeEach(async () => { world = new SimWorld(); await world.init(); world.loadScenario('combat-arena'); });
afterEach(() => world.dispose());
const selected = () => { const l = world.combat!.runner.loadout; return l.current(l.state.selectedSide).id; };
function equip(save: CampaignSave, id: string, key: number) {
  if (!save.ownedActions.includes(id)) save.ownedActions.push(id);
  if (![...save.racks.LEFT, ...save.racks.RIGHT].includes(id)) save.racks.RIGHT.push(id);
  applyCampaign(world, save);
  world.combat!.runner.loadout.input({ ...emptyInput(), selectedWeaponKey: key }, 60);
  expect(selected()).toBe(id);
}
function game(save: CampaignSave) {
  let stored: string | null = null;
  const g = Object.assign(Object.create(Game.prototype) as Game, {
    world, campaign: save, params: new URLSearchParams(),
    saves: new SaveStore({ getItem: () => stored, setItem: (_key, value) => { stored = value; }, removeItem: () => { stored = null; } }),
    view: { settings: vi.fn() }, audio: { set: vi.fn() },
    loadLevel: vi.fn(async (id: string) => { world.loadScenario('combat-arena'); world.scenario = id; applyCampaign(world, g.campaign!); }),
  });
  return g;
}

test.each([1, 2, 3, 4, 5, 6, 7, 8, 9] as const)('@E13 Q-158 L%i handover and menu Continue restore the selected action and its number key', async level => {
  const save = debugCampaign(level, null);
  const [id, key] = level === 1 ? ['weapon.fists', 1] as const : level === 2 ? ['weapon.molotov', 8] as const : level === 9 ? ['weapon.fire-axe', 3] as const : ['weapon.handgun', 4] as const;
  equip(save, id, key);
  if (level === 9) world.missions = { l9: { state: { finished: true, preCrashDurability: 10 } }, dispose: vi.fn() } as never;
  completeCampaignLevel(save, level, result, world);
  expect(save.selectedAction).toBe(id);
  expect(validateSave(save)).toBe(true);
  const decoded = decodeSave(JSON.stringify(save));
  if (decoded.status !== 'ok') throw new Error('Completed campaign did not reload');
  const g = game(decoded.save);
  await g.continueCampaign(decoded.save, (level + 1) as Level);
  expect(selected()).toBe(id);
  // Menu Continue traverses the same public entry point without a level override.
  await g.continueCampaign(decoded.save);
  expect(selected()).toBe(id);
  world.combat!.runner.loadout.input({ ...emptyInput(), selectedWeaponKey: key }, 120);
  expect(weaponKey(selected())).toBe(key);
});

test.each([2, 3, 4, 5, 6, 7, 8, 9, 10] as const)('@E13 Q-158 Continue into L%i falls back by key order when the saved action is absent', async level => {
  const save = debugCampaign(level, null);
  save.selectedAction = 'weapon.shotgun'; // valid historical action, unavailable in the destination rack
  save.ownedActions = save.ownedActions.filter(id => id !== 'weapon.shotgun');
  for (const side of ['LEFT', 'RIGHT'] as const) save.racks[side] = save.racks[side].filter(id => id !== 'weapon.shotgun');
  const expected = level === 10 ? 'weapon.fire-axe' : 'weapon.pipe-bomb';
  if (level !== 10) {
    save.ownedActions.push(...['weapon.pipe-bomb', 'weapon.handgun'].filter(id => !save.ownedActions.includes(id)));
    save.racks.RIGHT = ['weapon.handgun', 'weapon.pipe-bomb'];
  }
  expect(validateSave(save)).toBe(true);
  const decoded = decodeSave(JSON.stringify(save));
  if (decoded.status !== 'ok') throw new Error('Fallback save did not reload');
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  await game(decoded.save).continueCampaign(decoded.save);
  expect(selected()).toBe(expected);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('falling back'));
  log.mockRestore();
});

test('@E13 Q-158 a live menu save captures selection and acquired racks for Continue', async () => {
  const save = debugCampaign(3, null), g = game(save);
  save.selectedAction = 'weapon.fire-axe';
  equip(save, 'weapon.handgun', 4);
  world.scenario = 'L3';
  world.missions = { state: { phase: 'playing' }, dispose: vi.fn() } as never;
  expect(g.saveCampaign()).toBe(true);
  const loaded = g.saves.load();
  if (loaded.status !== 'ok') throw new Error('Menu save did not reload');
  expect(loaded.save.selectedAction).toBe('weapon.handgun');
  await g.continueCampaign(loaded.save);
  expect(selected()).toBe('weapon.handgun');
});

test('@E13 Q-158 replay completion updates the held action without granting rewards twice', () => {
  const save = debugCampaign(5, null), upgrades = [...save.upgrades];
  equip(save, 'weapon.handgun', 4);
  completeCampaignLevel(save, 3, result, world);
  expect(save.selectedAction).toBe('weapon.handgun');
  expect(save.upgrades).toEqual(upgrades);
});

test('@E13 Q-158 Continue does not capture the outgoing world while applying saved audio settings', async () => {
  const save = debugCampaign(3, null);
  equip(save, 'weapon.handgun', 4);
  world.scenario = 'L3'; world.missions = { state: { phase: 'playing' }, dispose: vi.fn() } as never;
  const incoming = structuredClone(save); incoming.selectedAction = 'weapon.fire-axe';
  const g = game(save);
  g.audio.set.mockImplementation(() => { g.saveCampaign(); });
  await g.continueCampaign(incoming);
  expect(selected()).toBe('weapon.fire-axe');
});

test('@E13 Q-158 the crossing logs the reason for losing the selected handgun and Continue restores the axe', async () => {
  const save = debugCampaign(9, null);
  equip(save, 'weapon.handgun', 4);
  world.missions = { l9: { state: { finished: true, preCrashDurability: 10 } }, dispose: vi.fn() } as never;
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  completeCampaignLevel(save, 9, result, world);
  expect(validateSave(save)).toBe(true);
  expect(log).toHaveBeenCalledWith(expect.stringContaining('scripted crossing arsenal loss'));
  await game(save).continueCampaign(save);
  expect(selected()).toBe('weapon.fire-axe');
  log.mockRestore();
});

test.each(['weapon.fire-axe', 'weapon.handgun'])('@E13 Q-158 L5 mission preparation preserves %s on its actual side', id => {
  const save = debugCampaign(5, null); save.selectedAction = id;
  const composition = compositions.L5;
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1);
  applyCampaign(world, save);
  world.loadMission(resolveCampaignMission('L5', world.districts!)).begin();
  expect(selected()).toBe(id);
});
