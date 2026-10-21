import { describe, expect, it } from 'vitest';
import { catalog } from '../../../src/data/actions/catalog';
import { newCampaign, preset, type CampaignSave, type Level } from '../../../src/sim/progression/Campaign';
import { campaignLoadout } from '../../../src/sim/progression/apply';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { decodeSave, validateSave } from '../../../src/sim/progression/Save';
import { Loadout } from '../../../src/sim/combat/Loadout';
import { emptyInput } from '../../../src/input/InputFrame';

/**
 * P1 10-20 (PO, after finishing L5 on PROD): "now I am in L6, but I lost the shotgun.... that's bad". E24: "There is no new weapon. The
 * player keeps the existing arsenal." Every weapon the courier carries at the end of a level is racked when the next level starts, and
 * the save that carries it still loads from the menu. L9 -> L10 is the authored crossing (only the axe survives) and is not a carry.
 */
const result = { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 0, optionalObjectives: [] };
const fakeWorld = (racks: CampaignSave['racks']) => ({
  entities: { get: (id: number) => id === 1 ? { weapons: { LEFT: { rack: racks.LEFT.map(id => ({ id })) }, RIGHT: { rack: racks.RIGHT.map(id => ({ id })) } } } : undefined, iterate: () => [][Symbol.iterator]() },
}) as never;
function start(level: Level): CampaignSave {
  if (level === 1) return newCampaign();
  return preset(`L${level}-default` as Parameters<typeof preset>[0]);
}

describe('weapon carry across level handovers', () => {
  it('key 1 selects innate bare hands while leaving the carried arsenal unchanged', () => {
    const save=preset('L8-default');
    expect([...save.racks.LEFT,...save.racks.RIGHT]).not.toContain('weapon.fists');
    expect([...save.racks.LEFT,...save.racks.RIGHT]).not.toContain('weapon.kick');
    const live=campaignLoadout(save,8);
    expect(live.LEFT).toEqual(save.racks.LEFT);
    expect(live.size).toBeGreaterThanOrEqual(live.LEFT.length);
    const input=new Loadout(live.LEFT,live.RIGHT,undefined,live.size);
    input.input({...emptyInput(),selectedWeaponKey:1},1);
    expect(input.current(input.state.selectedSide).id).toBe('weapon.fists');
  });
  it.each([1, 2, 3, 4, 5, 6, 7, 8] as const)('finishing L%i with an extra picked-up firearm starts the next level with it, and the save reloads', level => {
    const save = start(level);
    // What the courier holds at the end: the level's racks plus one more firearm picked up in the level (Pickups grows the rack by one).
    const extra = Object.keys(catalog).find(id => catalog[id].category === 'ranged' && !save.racks.RIGHT.includes(id) && !save.racks.LEFT.includes(id) && id !== 'weapon.rocket-launcher')!;
    const carried = { LEFT: [...save.racks.LEFT], RIGHT: [...save.racks.RIGHT, extra] };
    if (!save.ownedActions.includes(extra)) save.ownedActions.push(extra); // Game.watchCampaign: pickup.collected
    completeCampaignLevel(save, level, result, fakeWorld(carried));
    const next = (level + 1) as Level, loadout = campaignLoadout(save, next);
    // The unarmed fists are a fallback, not a carried weapon.
    for (const id of [...carried.LEFT, ...carried.RIGHT].filter(id => id !== 'weapon.fists')) expect([...loadout.LEFT, ...loadout.RIGHT], `L${level} -> L${next}: ${id}`).toContain(id);
    expect(validateSave(save), `L${level} -> L${next}: save validates`).toBe(true);
    expect(decodeSave(JSON.stringify(save)).status, `L${level} -> L${next}: reload from menu`).toBe('ok');
  });
});
