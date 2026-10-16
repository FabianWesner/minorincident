import { afterEach, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { loadLevel } from '../../tools/sim-runner/levels';
import type { SimWorld } from '../../src/sim/world/SimWorld';
import { emptyInput } from '../../src/input/InputFrame';
import { preset } from '../../src/sim/progression/Campaign';
import { l7Exit } from '../../src/levels/L7/layout';

let world: SimWorld | undefined;
afterEach(() => { world?.dispose(); world = undefined; });
function put(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x, z, y: w.districts!.groundHeight(x, z) + .705 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z);
}
function step(w: SimWorld, n = 1) { for (let i = 0; i < n; i++) w.update(); }
for (const checkpoint of ['night-exit', 'rocket', 'corridor']) test(`T-E29-16-${checkpoint} @E29-AC16 production checkpoint restores after actual death`, async () => {
  const campaign = preset('L5-default'); campaign.completedLevels = 6; campaign.unlockedLevel = 7;
  campaign.ownedActions.push('weapon.shotgun'); campaign.racks.RIGHT = ['weapon.army-mg', 'weapon.handgun', 'weapon.shotgun'];
  const w = world = await loadLevel('L7', 29, campaign), m = w.missions;
  expect(m, 'L7 must install its production mission').not.toBeNull();
  const c = w.l7Encounters!, d = w.l7Departure!, ids = c.state.roster.map(r => r.id);
  if (checkpoint !== 'night-exit') {
    // Losses before the next checkpoint must survive the retry with their original ids.
    w.entities.get(ids[0])!.health.current = 0;
    w.npcs!.civilians.outbreak!.turnNow(w.entities.get(ids[1])!);
    const pickup = w.entities.values().find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher')!;
    expect(Math.hypot(pickup.transform.x - l7Exit.position[0], pickup.transform.z - l7Exit.position[2])).toBeLessThanOrEqual(5);
    put(w, pickup.transform.x, pickup.transform.z);
    const f = emptyInput(); f.interact = true; w.applyInput(f, 'keyboard'); step(w, 37); w.clearInput();
    expect(m!.state.checkpoint).toBe('rocket');
    if (checkpoint === 'corridor') { put(w, -30, 47); step(w); }
  }
  expect(m!.state.checkpoint).toBe(checkpoint);
  // Exercise the actual capture saved by the graph, not a fixture checkpoint or restoreSeams call.
  const saved = JSON.parse(JSON.stringify(m!.saveResume().checkpoint));
  const before = { roster: structuredClone(c.state.roster), bus: structuredClone(d.state), entities: saved.entities, queue: saved.seams.l7Encounters.queue };
  c.state.roster[2].status = 'dead'; w.entities.get(ids[2])!.health.current = 0;
  d.state.boarded.push(ids[2]); d.state.phase = 'boarding'; w.infected!.director.queue.length = 0;
  let restoredQueue: unknown;
  w.events.on('checkpoint.restored', () => { restoredQueue = structuredClone(w.infected!.director.queue); });
  w.entities.get(1)!.survivor!.invulnerableUntil = 0;
  w.player!.damage(1000, w.tick);
  for (let i = 0; i < 400 && !w.events.events().some(e => e.type === 'checkpoint.restored'); i++) step(w);
  expect(w.events.events().some(e => e.type === 'player.respawned')).toBe(true);
  expect(w.events.events().flatMap(e => e.type === 'checkpoint.restored' ? [e.id] : [])).toEqual([checkpoint]);
  expect(m!.state.checkpoint).toBe(checkpoint); expect(m!.state.tier).toBe(6);
  expect(c.state.roster).toEqual(before.roster); expect(d.state).toEqual(before.bus);
  expect(restoredQueue).toEqual(before.queue);
  for (const id of ids) {
    const actual = w.entities.get(id)!, expected = before.entities.find((e: { id: number }) => e.id === id)!;
    expect(actual.health).toEqual(expected.health); expect(actual.appearance).toEqual(expected.appearance);
    expect(!!actual.infected).toBe(!!expected.infected);
  }
  expect(new Set(w.entities.values().map(e => e.id)).size).toBe(w.entities.size);
  expect(w.entities.values().filter(e => e.kind === 'setpiece' && e.archetype === 'veh.evac-bus')).toHaveLength(1);
  expect(w.entities.values().filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher')).toHaveLength(checkpoint === 'night-exit' ? 1 : 0);
  const p = w.entities.get(1)!, cp = saved.entities.find((e: { id: number }) => e.id === 1)!;
  expect(Math.hypot(p.transform.x - cp.transform.x, p.transform.z - cp.transform.z)).toBeLessThanOrEqual(1.5);
  expect(w.progression!.campaign!.ownedActions).toEqual(saved.arsenal.ownedActions);
  expect(w.progression!.campaign!.ownedActions.includes('weapon.rocket-launcher')).toBe(checkpoint !== 'night-exit');
  expect(p.weapons!.RIGHT.rack.map(s => s.id)).toEqual(cp.weapons.RIGHT.rack.map((s: { id: string }) => s.id));
  expect(w.infected!.nav.clear(-78.5, 47, .4), 'waiting bus blocker restored').toBe(false);
}, 120_000);

test('T-E29-16-west @E29-AC16 west alley arrival records corridor and resumes a partially boarded bus', async () => {
  const w = world = await loadLevel('L7', 29), c = w.l7Encounters!, d = w.l7Departure!, m = w.missions!;
  // Reach the bus before collecting the optional route-side weapon; boarding is never gated by a kill counter.
  const [first, straggler] = c.state.roster;
  for (const r of c.state.roster.slice(2)) w.entities.get(r.id)!.health.current = 0;
  const e = w.entities.get(first.id)!; Object.assign(e.transform, { x: -72.6, z: 47 });
  w.spatial.set(e.id, -72.6, 47); put(w, -70.5, 47.5); step(w, 80);
  expect(d.state.boarded).toEqual([first.id]); expect(d.state.phase).toBe('boarding');
  expect(d.state.boarded).not.toContain(straggler.id);
  const pickup = w.entities.values().find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher')!;
  put(w, pickup.transform.x, pickup.transform.z);
  const f = emptyInput(); f.interact = true; w.applyInput(f, 'keyboard'); step(w, 37); w.clearInput();
  put(w, -70.5, 47.5); step(w);
  expect(m.state.checkpoint).toBe('corridor');
  const saved = JSON.parse(JSON.stringify(m.saveResume()));
  expect(saved.checkpoint.seams.l7Departure.state.boarded).toEqual([first.id]);
  // Load the serialized production snapshot, then die: the saved bus and roster must be restored again.
  m.loadResume(saved);
  expect(d.state.boarded).toEqual([first.id]); expect(w.entities.get(first.id)!.hidden).toBe(true);
  w.entities.get(1)!.survivor!.invulnerableUntil = 0; w.player!.damage(1000, w.tick);
  step(w, 120);
  expect(m.state.checkpoint).toBe('corridor'); expect(d.state.boarded).toEqual([first.id]);
  expect(c.state.roster.map(r => r.id)).toEqual(saved.checkpoint.seams.l7Encounters.state.roster.map((r: { id: number }) => r.id));
  expect(d.state.phase).toBe('boarding'); expect(w.infected!.nav.clear(-78.5, 47, .4)).toBe(false);
}, 120_000);


test('T-E24-14-handover @E24-AC14 @E29-AC03 L6 reachability is disposed before L7 places its exit pickup', async () => {
  const w = world = await loadLevel('L6', 1), oldRescue = w.trapRescue;
  expect(oldRescue).not.toBeNull();
  const layout = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8'));
  // Game reuses its SimWorld at Continue. A fresh-world L7 fixture hid this stale reachability mask.
  expect(() => w.loadComposition(compositions.L7, [layout], 1)).not.toThrow();
  expect(w.trapRescue).toBeNull();
  w.loadMission(resolveCampaignMission('L7', w.districts!)).begin();
  expect(w.trapRescue).not.toBe(oldRescue); expect(w.missions!.state.checkpoint).toBe('night-exit');
  const pickups = w.entities.values().filter(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === 'weapon.rocket-launcher');
  expect(pickups).toHaveLength(1);
  expect(Math.hypot(pickups[0].transform.x - l7Exit.position[0], pickups[0].transform.z - l7Exit.position[2])).toBeLessThanOrEqual(5);
}, 120_000);
