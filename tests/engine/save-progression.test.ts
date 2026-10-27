// Save, load, Continue and the level handovers: one code path carries the courier's arsenal, upgrades and
// world state through all ten levels. A regression here costs players their weapons (P1 10-20: "I lost the shotgun").
import { expect, test, vi } from 'vitest';
import { action, catalog } from '../../src/data/actions/catalog';
import { emptyInput } from '../../src/input/InputFrame';
import { Loadout } from '../../src/sim/combat/Loadout';
import { beginRewards, finishRewards, gearTier, newCampaign, pickUpgrades, preset, revealCards, type CampaignSave, type Level } from '../../src/sim/progression/Campaign';
import { campaignLoadout, restoreSelectedAction } from '../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../src/sim/progression/carryover';
import { decodeSave, SaveStore, validateSave } from '../../src/sim/progression/Save';

const result = { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] };
/** The slice of a world that completeCampaignLevel reads: the player's two racks and the selected action. */
const fakeWorld = (racks: CampaignSave['racks'], selectedAction = 'weapon.handgun') => ({
  entities: { get: (id: number) => id === 1 ? { weapons: { selectedSide: racks.RIGHT.includes(selectedAction) ? 'RIGHT' : 'LEFT', LEFT: { index: racks.LEFT.indexOf(selectedAction), rack: racks.LEFT.map(id => ({ id })) }, RIGHT: { index: racks.RIGHT.indexOf(selectedAction), rack: racks.RIGHT.map(id => ({ id })) } } } : undefined, iterate: () => [][Symbol.iterator]() },
}) as never;
const start = (level: Level): CampaignSave => level === 1 ? newCampaign() : preset(`L${level}-default` as Parameters<typeof preset>[0]);
const resume = (save: CampaignSave, level: number) => { const l = campaignLoadout(save, level as Level); return new Loadout(l.LEFT, l.RIGHT, undefined, l.size); };

test('every handover L1→L9 keeps every carried weapon (plus a picked-up firearm) and the selected action, and the save reloads', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
    const save = start(level), next = level + 1;
    const extra = Object.keys(catalog).find(id => catalog[id].category === 'ranged' && !save.racks.RIGHT.includes(id) && !save.racks.LEFT.includes(id) && id !== 'weapon.rocket-launcher')!;
    const carried = { LEFT: [...save.racks.LEFT], RIGHT: [...save.racks.RIGHT, extra] };
    if (!save.ownedActions.includes(extra)) save.ownedActions.push(extra);
    const selected = carried.RIGHT.includes('weapon.handgun') ? 'weapon.handgun' : carried.RIGHT[0];
    completeCampaignLevel(save, level, result, fakeWorld(carried, selected));
    const loadout = campaignLoadout(save, next as Level);
    for (const id of [...carried.LEFT, ...carried.RIGHT].filter(id => id !== 'weapon.fists')) expect([...loadout.LEFT, ...loadout.RIGHT], `L${level}→L${next}: ${id}`).toContain(id);
    expect(save.selectedAction, `L${level}`).toBe(selected);
    // Menu Continue: decode the stored JSON and restore the selection on a fresh loadout.
    const decoded = decodeSave(JSON.stringify(save));
    expect(decoded.status, `L${level}→L${next}: reload from menu`).toBe('ok');
    const resumed = resume((decoded as { save: CampaignSave }).save, next);
    restoreSelectedAction(resumed, save);
    expect(resumed.current(resumed.state.selectedSide).id, `L${level}→L${next}`).toBe(selected);
    expect(validateSave(save)).toBe(true);
  }
});

test('selection fallback: lost or empty weapons fall back to the best usable owned weapon, never an empty finite gun', () => {
  const lost = preset('L8-default'); lost.selectedAction = 'weapon.shotgun';
  lost.ownedActions = lost.ownedActions.filter(id => id !== 'weapon.shotgun'); lost.racks.RIGHT = lost.racks.RIGHT.filter(id => id !== 'weapon.shotgun');
  const r = resume(lost, 9); restoreSelectedAction(r, lost);
  expect(r.current(r.state.selectedSide).id).toBe('weapon.rocket-launcher');

  const save = newCampaign(); save.ownedActions.push('weapon.bat', 'weapon.fire-axe', 'weapon.pistol', 'weapon.smg');
  const loadout = new Loadout(['weapon.bat', 'weapon.fire-axe'], ['weapon.pistol', 'weapon.smg']);
  expect(restoreSelectedAction(loadout, save)).toBe('weapon.pistol');
  loadout.state.RIGHT.rack[0].magazine = 0; expect(restoreSelectedAction(loadout, save)).toBe('weapon.smg');
  loadout.state.RIGHT.rack[1].magazine = 0; expect(restoreSelectedAction(loadout, save)).toBe('weapon.fire-axe');
  save.ownedActions = save.ownedActions.filter(id => id !== 'weapon.fire-axe'); expect(restoreSelectedAction(loadout, save)).toBe('weapon.bat');
  expect(loadout.state.LEFT.swapUntil).toBe(0); expect(loadout.state.RIGHT.swapUntil).toBe(0);

  // A finite MG carried in empty is skipped; the real bottomless campaign MG stays usable at zero counters.
  const mg = preset('L5-default'); mg.selectedAction = 'weapon.army-mg'; mg.ownedActions.push('weapon.pipe-bomb');
  const finite = new Loadout(['weapon.fire-axe'], ['weapon.army-mg', 'weapon.handgun', 'weapon.pipe-bomb'], id => id === 'weapon.army-mg' ? { ...action(id), magazine: 6, reloadTime: 1 } : action(id));
  finite.state.RIGHT.rack[0].magazine = 0; finite.state.RIGHT.rack[2].charges = 0;
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
  expect(restoreSelectedAction(finite, mg)).toBe('weapon.handgun');
  const bottomless = new Loadout(mg.racks.LEFT, mg.racks.RIGHT);
  expect(restoreSelectedAction(bottomless, mg)).toBe('weapon.army-mg');
});

test('bare hands are innate: key 1 selects fists without them entering the carried racks', () => {
  const save = preset('L8-default');
  expect([...save.racks.LEFT, ...save.racks.RIGHT]).not.toContain('weapon.fists');
  const live = campaignLoadout(save, 8), input = new Loadout(live.LEFT, live.RIGHT, undefined, live.size);
  expect(live.LEFT).toEqual(save.racks.LEFT);
  input.input({ ...emptyInput(), selectedWeaponKey: 1 }, 1);
  expect(input.current(input.state.selectedSide).id).toBe('weapon.fists');
  save.selectedAction = 'weapon.fists';
  expect(restoreSelectedAction(resume(save, 8), save)).toBe('weapon.rocket-launcher');
});

test('save decoding: presets round-trip, v0 migrates, corrupt/unknown data and storage errors fail safely', () => {
  for (const level of [2, 3, 4, 5, 6, 7, 8, 10] as const) {
    const save = preset(`L${level}-default`);
    expect(validateSave(save), `L${level}`).toBe(true);
    expect(decodeSave(JSON.stringify(save)), `L${level}`).toEqual({ status: 'ok', save });
    expect(save.unlockedLevel, `L${level}`).toBe(level);
  }
  const save = preset('L5-default');
  const { unlockedLevel, ...rest } = save;
  expect(decodeSave(JSON.stringify({ ...rest, version: 0, level: unlockedLevel }))).toEqual({ status: 'ok', save });
  for (const data of ['{', 'null', '[]', JSON.stringify({ ...save, version: 99 }), JSON.stringify({ ...save, ownedActions: [...save.ownedActions, 'toString'] }), JSON.stringify({ ...save, upgrades: ['unknown'] }), JSON.stringify({ ...save, racks: { LEFT: ['unknown'], RIGHT: [] } })])
    expect(decodeSave(data).status, data.slice(0, 40)).not.toBe('ok');
  const broken = new SaveStore({ getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }, removeItem() { throw new Error('blocked'); } });
  expect(broken.load().status).toBe('error'); expect(broken.write(save)).toBe(false); expect(broken.clear()).toBe(false);
  const entries = new Map<string, string>();
  const store = new SaveStore({ getItem: k => entries.get(k) ?? null, setItem: (k, v) => { entries.set(k, v); }, removeItem: k => { entries.delete(k); } });
  expect(store.write(save)).toBe(true);
  expect(store.load()).toEqual({ status: 'ok', save });
});

test('rewards: a saved reward screen round-trips at each phase and cannot be claimed twice; gear tiers follow the default path', () => {
  const save = newCampaign(); save.ownedActions.push('weapon.bat');
  beginRewards(save, 1); expect(validateSave(save)).toBe(true);
  revealCards(save); expect(validateSave(save)).toBe(true);
  pickUpgrades(save, save.pending!.cards.slice(0, 2)); expect(validateSave(save)).toBe(true);
  finishRewards(save, save.racks);
  expect(() => beginRewards(save, 1)).toThrow();
  expect([2, 3, 4, 5, 6].map(level => gearTier(preset(`L${level as 2 | 3 | 4 | 5 | 6}-default`)))).toEqual([0, 1, 2, 3, 4]);
});
