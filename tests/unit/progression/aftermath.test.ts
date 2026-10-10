import { expect, test } from 'vitest';
import { newCampaign, preset } from '../../../src/sim/progression/Campaign';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { decodeSave, SaveStore, validateSave } from '../../../src/sim/progression/Save';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { MissionResult } from '../../../src/sim/missions/types';

const result: MissionResult = { time: 120, kills: 3, knockdowns: 0, damage: 10, deaths: 0, rescued: 0, optionalObjectives: [] };

test('@E13 @E13-AC05 completion persists the next unlock and L1 aftermath; replays do not duplicate rewards', async () => {
  const world = new SimWorld(); await world.init();
  try {
    world.loadScenario('survivor'); world.vehicles!.bicycle.spawn({ x: 20, z: 10 });
    const save = newCampaign();
    completeCampaignLevel(save, 1, result, world);
    let stored: string | null = null;
    const store = new SaveStore({ getItem: () => stored, setItem: (_key, value) => { stored = value; }, removeItem: () => { stored = null; } });
    expect(store.write(save)).toBe(true);
    const loaded = store.load(); expect(loaded.status).toBe('ok');
    if (loaded.status !== 'ok') throw new Error('Save did not reload');
    expect(loaded.save.unlockedLevel).toBe(2); expect(loaded.save.completedLevels).toBe(1);
    expect(loaded.save.world?.L1?.bike).toMatchObject({ x: 20, z: 10 });
    expect(loaded.save.results?.L1).toEqual(result);
    const upgrades = [...save.upgrades];
    world.vehicles!.bicycle.entity!.transform.x = 21;
    completeCampaignLevel(save, 1, { ...result, kills: 4 }, world);
    expect(save.upgrades).toEqual(upgrades); expect(save.world?.L1?.bike?.x).toBe(21);
    expect(validateSave(save)).toBe(true);
  } finally { world.dispose(); }
});

test('@E13 @E13-AC06 v1 migrates with and without aftermath, preserving L5 survivors and results', async () => {
  const world = new SimWorld(); await world.init();
  try {
    world.loadScenario('combat-arena');
    const save = preset('L5-default');
    completeCampaignLevel(save, 5, { ...result, rescued: 2, survivors: ['rosa', 'sam'] }, world);
    expect(save.unlockedLevel).toBe(6); expect(save.survivors).toEqual(['rosa', 'sam']);
    expect(decodeSave(JSON.stringify({ ...save, version: 1 }))).toEqual({ status: 'ok', save });
    const fresh = newCampaign();
    expect(decodeSave(JSON.stringify({ ...fresh, version: 1 }))).toEqual({ status: 'ok', save: fresh });
    completeCampaignLevel(fresh, 1, result, world);
    expect(decodeSave(JSON.stringify({ ...fresh, version: 1 }))).toEqual({ status: 'ok', save: fresh });
    for (const survivors of ['rosa', ['unknown'], ['sam', 'sam']]) expect(decodeSave(JSON.stringify({ ...save, survivors })).status).toBe('error');
    for (const results of [[], { L1: null }, { L1: { ...result, kills: 'three' } }]) expect(decodeSave(JSON.stringify({ ...save, results })).status).toBe('error');
  } finally { world.dispose(); }
});
