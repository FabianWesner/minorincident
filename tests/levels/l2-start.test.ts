import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { l2, l2Station } from '../../src/data/l2';
import { l4 } from '../../src/data/l4';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { seatAnchor } from '../../src/sim/npc/seats';
import { applyCampaign } from '../../src/sim/progression/apply';
import { preset, type CampaignSave } from '../../src/sim/progression/Campaign';
import { SimWorld } from '../../src/sim/world/SimWorld';

/**
 * PO 2026-10-12 "Start of L2 is broken. I start with the axe in my hands before I picked it up" and the bay-bench finding.
 * A level's own pickup (L2 axe, L3 handgun, L4 machine gun, L5 shotgun) is never owned at the level start, whichever way the
 * level was entered (handover preset or a replay/Continue save whose racks already carry it).
 */
const HEAVY = 300_000;
type Id = 'L2' | 'L3' | 'L4' | 'L5';
const pickup: Record<Id, string> = { L2: 'weapon.fire-axe', L3: 'weapon.handgun', L4: l4.machineGun.id, L5: 'weapon.shotgun' };
const comps = { L2: compositions.L2, L3: compositions.L3, L4: compositions.L4, L5: compositions.L5 };

async function start(id: Id, save: CampaignSave) {
  const world = new SimWorld(); await world.init();
  const composition = comps[id];
  world.loadComposition(composition, composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8'))), 1, null);
  applyCampaign(world, save);
  const mission = world.loadMission(resolveCampaignMission(id, world.districts!)); mission.begin();
  return { world, mission };
}
const held = (world: SimWorld) => { const w = world.entities.get(1)!.weapons!; return [...w.LEFT.rack, ...w.RIGHT.rack].map(s => s.id); };
/** A save from late in the campaign whose racks hold every level pickup (replay of an earlier level / Continue). */
const loaded = (): CampaignSave => ({ ...preset('L6-default'), racks: { LEFT: ['weapon.fire-axe', 'weapon.bat'], RIGHT: ['weapon.army-mg', 'weapon.handgun', 'weapon.shotgun'] } });

describe('level start loadouts (no pickup owned before it is taken)', () => {
  for (const id of ['L2', 'L3', 'L4', 'L5'] as const) {
    test(`T-L2START-${id} @l2start ${id} starts without ${pickup[id]} from a loaded save`, async () => {
      const { world } = await start(id, loaded());
      expect(held(world)).not.toContain(pickup[id]);
      expect(held(world).length).toBeGreaterThan(0);
      world.dispose();
    }, HEAVY);
  }
  test('T-L2START-L2-handover @l2start L2 from the L1 handover keeps the bat and has no axe', async () => {
    const { world } = await start('L2', preset('L2-default'));
    expect(held(world)).toContain('weapon.bat');
    expect(held(world)).not.toContain('weapon.fire-axe');
    world.dispose();
  }, HEAVY);
  test('T-L2START-L2-keep @l2start the L2 loaded-save start keeps the other racked weapons', async () => {
    const { world } = await start('L2', loaded());
    expect(held(world)).toEqual(expect.arrayContaining(['weapon.bat', 'weapon.army-mg', 'weapon.handgun']));
    world.dispose();
  }, HEAVY);
});

describe('L2 station bench sitters', () => {
  test('T-L2START-seats @l2start sitters sit on the benches outside the building, hips on the seat anchor; off the seat they stand', async () => {
    const { world, mission } = await start('L2', preset('L2-default'));
    const district = world.districts!.districts[0], [ox, oz] = district.origin;
    const benches = district.layout.placements.filter(p => p.id.startsWith('l2-station-') && p.assetId === 'prop.bench');
    expect(benches.length).toBe(2);
    const local = (x: number, z: number) => ({ x: (x - l2Station.x) * Math.cos(l2Station.yaw) - (z - l2Station.z) * Math.sin(l2Station.yaw), z: (x - l2Station.x) * Math.sin(l2Station.yaw) + (z - l2Station.z) * Math.cos(l2Station.yaw) });
    for (const b of benches) {
      const l = local(b.position[0] + ox, b.position[2] + oz);
      // Station interior is local x -4.5..1.5: the bench (0.75 m deep) is entirely on the apron.
      expect(l.x - .4, `${b.id} outside the building footprint`).toBeGreaterThan(1.5);
      expect(b.position[1], 'bench stands on the apron slab').toBeCloseTo(.4, 2);
    }
    const ids = mission.state.l2!.benchIds;
    expect(ids.length).toBe(l2.calm.civiliansOnBenches);
    for (const id of ids) {
      const e = world.entities.get(id)!, step = e.civilian!.schedule![0];
      expect(step.activity).toBe('sit');
      const seat = step.seat!, nearest = benches.map(b => seatAnchor(b.assetId, b.position, b.yaw, b.scale, { x: ox, z: oz })!).sort((a, b) => Math.hypot(a.x - seat.x, a.z - seat.z) - Math.hypot(b.x - seat.x, b.z - seat.z))[0];
      expect(Math.hypot(nearest.x - seat.x, nearest.z - seat.z), 'hip-to-seat distance (xz)').toBeLessThan(.6);
      // The root lift puts the hip joint on the seat plane above the sitter's own ground (bench base is the slab, the sitter stands on it).
      expect(step.seatLift).toBeCloseTo(nearest.lift, 5);
      expect(local(e.transform.x, e.transform.z).x, 'sitter outside the building').toBeGreaterThan(1.5);
    }
    // Leaving the seat (flee, hide, grabbed...) drops the seat: no sitting pose or lift can follow the actor into the street.
    const e = world.entities.get(ids[0])!;
    expect(e.civilian!.schedule![0].seat).toBeDefined();
    world.npcs!.civilians.state(e, 'flee');
    expect(e.civilian!.schedule![0].seat).toBeUndefined();
    expect(e.civilian!.schedule![0].seatLift).toBeUndefined();
    expect(e.civilian!.schedule![0].activity).not.toBe('sit');
    expect(e.civilian!.activityUntil).toBe(0);
    world.dispose();
  }, HEAVY);
});
