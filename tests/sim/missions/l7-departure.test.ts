import { readFileSync } from 'node:fs';
import { afterEach, expect, test } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { l7Departure } from '../../../src/data/l7';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { completeCampaignLevel } from '../../../src/sim/progression/carryover';
import { nextLevelAfter, preset } from '../../../src/sim/progression/Campaign';
import { validateSave } from '../../../src/sim/progression/Save';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function load(roster?: EntitySnapshot[], tier: 'high' | 'low' = 'high') {
  const w = new SimWorld(); worlds.push(w); await w.init();
  w.loadComposition(compositions.L7, [JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8'))], 29, null, roster);
  w.npcs!.setQuality(tier); w.l7Encounters!.prepare(roster); w.combat!.damage.god = true;
  // The horde is not part of the boarding contract: keep the street quiet and fast.
  w.l7Encounters!.state.started = true;
  return w;
}
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function put(w: SimWorld, id: number, x: number, z: number) {
  const e = w.entities.get(id)!; Object.assign(e.transform, { x, z, y: w.districts!.groundHeight(x, z) + .7 }); expect(w.solids.admit(e, 'test.l7.put', 4, false)).toBe(true);
  if (id === 1) { w.physics.playerBody!.setTranslation(e.transform, true); w.physics.playerBody!.setNextKinematicTranslation(e.transform); }
}
/** Survivors a few metres east of the bus, on free cells of the corridor lane. */
function gather(w: SimWorld, ids: number[], x0 = -64) {
  const nav = w.infected!.nav; let n = 0;
  for (let x = x0; n < ids.length && x < x0 + 40; x += 1) for (const z of [46.5, 47.5, 48.5, 45.5, 49.5]) {
    if (n < ids.length && nav.clear(x, z, .4)) put(w, ids[n++], x, z);
  }
  expect(n).toBe(ids.length);
}
const boardingAnchor = () => compositions.L7 && { x: -70.5, z: 47.5 };

test('T-E29-13-board @E29-AC13 the complete living roster boards before the bus leaves; the bus moves >= 30 m in 6-10 s; L8 gets the exact roster', async () => {
  const w = await load(), c = w.l7Encounters!, d = w.l7Departure!, ids = c.state.roster.map(r => r.id);
  expect(ids.length).toBe(24);
  const bus = w.entities.get(d.state.busId)!, start = { x: bus.transform.x, z: bus.transform.z };
  gather(w, ids);
  // One survivor died on the way: a loss never holds the bus.
  w.entities.get(ids[0])!.health.current = 0;
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z);
  let departed = -1;
  for (let i = 0; i < 2400 && d.state.phase !== 'departing'; i++) {
    const before = ids.map(id => ({ ...w.entities.get(id)!.transform })); step(w, 1);
    ids.forEach((id, j) => { const e = w.entities.get(id)!; if (!e.hidden && j > 0) expect(Math.hypot(e.transform.x - before[j].x, e.transform.z - before[j].z), `survivor ${id} (#${j}) teleported at tick ${i} phase ${d.state.phase} entering ${id in d.state.entering} from ${JSON.stringify(before[j])} to ${JSON.stringify(e.transform)}`).toBeLessThanOrEqual(1); });
    if ((d.state.phase as string) === 'departing') departed = i;
  }
  expect(d.state.phase).toBe('departing');
  const living = ids.slice(1);
  expect([...d.state.boarded].sort((a, b) => a - b)).toEqual(living);
  expect(living.every(id => w.entities.get(id)!.hidden)).toBe(true);
  // Aboard before the bus moves: it has not left its spot yet.
  expect(bus.transform.x).toBeCloseTo(start.x, 1);
  expect(w.entities.get(1)!.hidden).toBe(true); expect(w.storyLock).not.toBeNull();
  expect(departed).toBeGreaterThan(0);
  let completed: { id: string; result: { escapedSurvivors?: EntitySnapshot[]; survivors?: string[]; rescued: number } } | null = null;
  w.events.on('level.completed', e => { if (e.type === 'level.completed') completed = e as never; });
  let ticks = 0;
  for (; ticks < 700 && d.state.phase !== 'done'; ticks++) step(w, 1);
  expect(d.state.phase).toBe('done');
  expect(ticks / 60).toBeGreaterThanOrEqual(6); expect(ticks / 60).toBeLessThanOrEqual(10);
  expect(Math.hypot(bus.transform.x - start.x, bus.transform.z - start.z)).toBeGreaterThanOrEqual(30);
  expect(w.entities.get(1)!.transform.x).toBeCloseTo(bus.transform.x, 5);
  expect(w.entities.get(1)!.transform.z).toBeCloseTo(bus.transform.z, 5);
  expect(completed!.id).toBe('L7');
  expect(completed!.result.escapedSurvivors!.map(e => e.id)).toEqual(d.state.boarded);
  expect(completed!.result.rescued).toBe(living.length);
  // Identity and health survive the handover unchanged.
  for (const e of completed!.result.escapedSurvivors!) expect(e.health).toEqual(w.entities.get(e.id)!.health);
  step(w, 120); expect(d.state.phase).toBe('done');
});

test('T-E29-13-bite-loss @E29-AC13 fatal-bite bodies with positive HP never hold or board the bus', async () => {
  const w = await load(), c = w.l7Encounters!, d = w.l7Departure!;
  for (const r of c.state.roster) {
    const e = w.entities.get(r.id)!; expect(e.health.current).toBeGreaterThan(0); e.civilian!.state = 'finished';
  }
  // A victim bitten during its door approach also leaves the entering queue.
  d.state.entering[c.state.roster[0].id] = w.tick;
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z);
  step(w, 1);
  expect(c.state.roster.every(r => r.status === 'dead')).toBe(true);
  expect(d.state.entering).toEqual({}); expect(d.state.boarded).toEqual([]);
  expect(d.state.phase).toBe('departing');
});

test('T-E29-13-wait @E29-AC13 a straggler holds the bus; the player is never timed out', async () => {
  const w = await load(), c = w.l7Encounters!, d = w.l7Departure!, ids = c.state.roster.map(r => r.id);
  gather(w, ids.slice(0, 23));
  put(w, ids[23], -40, 47); // 31 m away, still walking
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z);
  step(w, 600);
  expect(d.state.phase).toBe('boarding'); expect(d.state.boarded.length).toBe(23);
  expect(w.entities.get(1)!.hidden).not.toBe(true);
  // 30 s later it is still waiting at the door queue, never teleported aboard.
  for (let i = 0; i < 3000 && !d.state.boarded.includes(ids[23]); i++) step(w, 1);
  expect(d.state.boarded.includes(ids[23])).toBe(true);
  step(w, 5); expect(['departing', 'done']).toContain(d.state.phase);
});

test('T-E29-13-zero @E29-AC13 zero survivors: the courier boards alone; leaving the bus pauses boarding', async () => {
  const w = await load([]), d = w.l7Departure!;
  expect(w.l7Encounters!.state.roster).toHaveLength(0);
  put(w, 1, -40, 47); step(w, 30); expect(d.state.phase).toBe('waiting');
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z); step(w, 3);
  expect(d.state.phase).toBe('departing'); expect(d.state.boarded).toEqual([]);
});

test('T-E29-13-bus-blocks @E29-AC13 the waiting bus blocks the player and navigation; the lane is free once it leaves', async () => {
  const w = await load([]), d = w.l7Departure!, nav = w.infected!.nav;
  expect(nav.clear(-78.5, 47, .4)).toBe(false); expect(nav.clear(-60, 47, .4)).toBe(true);
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z); step(w, 600);
  expect(d.state.phase).toBe('done');
  expect(nav.clear(-78.5, 47, .4)).toBe(true);
  expect(d.cameraPose()).not.toBeNull(); expect(l7Departure.seconds).toBeGreaterThanOrEqual(6); expect(l7Departure.seconds).toBeLessThanOrEqual(10);
});

test('T-E29-13-handover @E29-AC13 L7 completion unlocks L8 and carries the arsenal; L9 continues to L10', () => {
  const save = preset('L6-default'); save.completedLevels = 6; save.unlockedLevel = 7;
  const world = { entities: { get: () => ({ weapons: { LEFT: { rack: [{ id: 'weapon.bat' }] }, RIGHT: { rack: [{ id: 'weapon.handgun' }, { id: 'weapon.rocket-launcher' }] } } }) } } as never;
  completeCampaignLevel(save, 7, { time: 1, kills: 0, knockdowns: 0, damage: 0, deaths: 0, rescued: 2, optionalObjectives: [], survivors: ['a', 'b'] }, world);
  expect(save.completedLevels).toBe(7); expect(save.unlockedLevel).toBe(8); expect(save.racks.RIGHT).toEqual(['weapon.handgun', 'weapon.rocket-launcher']);
  expect(save.results!.L7.survivors).toEqual(['a', 'b']);
  expect(validateSave(save)).toBe(true);
  expect(nextLevelAfter(7)).toBe(8); expect(nextLevelAfter(9)).toBe(10);
});

test('T-E29-13-35 @E29-AC13 a full 35-person roster boards and every figure is accounted for', async () => {
  const source = await load(), base = source.entities.get(source.l7Encounters!.state.roster[0].id)!;
  const incoming = Array.from({ length: 35 }, (_, i) => { const e = structuredClone(base); e.id = 40 + i; e.health.current = 30 + i; e.civilian!.survivor!.key = `carry-${i}`; return e; });
  const w = await load(incoming, 'low'), d = w.l7Departure!;
  for (const e of incoming) expect(w.entities.get(e.id)!.health.current).toBe(e.health.max);
  // An injury acquired in L7 remains in its departure snapshot; recovery belongs to the next level's arrival.
  w.entities.get(incoming[0].id)!.health.current = 23;
  const departureHealth = incoming.map(e => [e.id, w.entities.get(e.id)!.health.current]);
  gather(w, incoming.map(e => e.id), -66);
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z);
  for (let i = 0; i < 3000 && d.state.phase !== 'departing'; i++) step(w, 1);
  expect(d.state.phase, JSON.stringify(incoming.filter(e => !d.state.boarded.includes(e.id)).map(e => {
    const live = w.entities.get(e.id)!; return { id: e.id, at: live.transform, passengerOf: live.passengerOf, pending: live.pendingAdmission, entering: d.state.entering[e.id], path: live.civilian!.path, goal: live.civilian!.goal };
  }))).toBe('departing');
  expect([...d.state.boarded].sort((a, b) => a - b)).toEqual(incoming.map(e => e.id));
  let done: { result: { escapedSurvivors: EntitySnapshot[] } } | null = null;
  w.events.on('level.completed', e => { if (e.type === 'level.completed') done = e as never; });
  step(w, 600);
  expect(done!.result.escapedSurvivors.map(e => [e.id, e.health.current]).sort((a, b) => a[0] - b[0])).toEqual(departureHealth);
});

test('a finished civilian retains its identity as a loss and never holds the boarding roster', async () => {
  const w = await load(), c = w.l7Encounters!, d = w.l7Departure!;
  const ids = c.state.roster.map(r => r.id), victim = w.entities.get(ids[0])!;
  for (const id of ids.slice(1)) w.entities.get(id)!.health.current = 0;
  // The outbreak finish lifecycle preserves positive civilian HP, as in L6.
  victim.civilian!.state = 'finished';
  expect(victim.health.current).toBeGreaterThan(0);
  put(w, 1, boardingAnchor()!.x, boardingAnchor()!.z); step(w, 3);
  expect(c.state.roster).toHaveLength(ids.length);
  expect(c.state.roster.every(r => r.status === 'dead')).toBe(true);
  expect(ids.every(id => w.entities.get(id))).toBe(true);
  expect(d.state.phase).toBe('departing'); expect(d.state.boarded).toEqual([]);
  expect(w.solids.snapshot().failures).toBe(0);
});

test('the last queue follower walks around a courier standing across its boarding approach', async () => {
  const w = await load(), c = w.l7Encounters!, d = w.l7Departure!;
  const last = c.state.roster[0]; last.injured = true;
  for (const r of c.state.roster.slice(1)) w.entities.get(r.id)!.health.current = 0;
  const e = w.entities.get(last.id)!; e.civilian!.survivor!.slot = 28;
  put(w, 1, -69.62994384765625, 47.41989517211914);
  put(w, e.id, -68.94034510767726, 47.54581013477008);
  for (let i = 0; i < 1200 && d.state.phase !== 'departing'; i++) step(w, 1);
  expect(d.state.boarded).toEqual([e.id]); expect(d.state.phase).toBe('departing');
  expect(w.solids.snapshot()).toMatchObject({ failures: 0, pending: 0 });
});
