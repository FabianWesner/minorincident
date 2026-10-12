import { readFileSync } from 'node:fs';
import { afterEach, expect, test, vi } from 'vitest';
import { compositions } from '../../../src/levels/compositions';
import { l7Encounters } from '../../../src/data/l7';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { captureSeams, restoreSeams } from '../../../src/sim/missions/l1Seams';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import { LevelSixSubway } from '../../../src/sim/missions/LevelSixSubway';
import type { Mission } from '../../../src/sim/missions/Mission';
const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
async function load(tier: 'high' | 'low' = 'high', roster?: EntitySnapshot[]) {
  const w = new SimWorld(); worlds.push(w); await w.init();
  w.loadComposition(compositions.L7, [JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8'))], 29, null, roster);
  w.npcs!.setQuality(tier); w.l7Encounters!.prepare(roster); w.combat!.damage.god = true;
  return w;
}
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function teleport(w: SimWorld, x: number, z: number) {
  const p = w.entities.get(1)!;
  Object.assign(p.transform, { x, z, y: w.districts!.groundHeight(x, z) + .7 });
  w.physics.playerBody!.setTranslation(p.transform, true); w.spatial.set(1, x, z);
}
for (const tier of ['high', 'low'] as const) test(`T-E29-08 @E29-AC08 ${tier}: all arrivals, five Alphas, safe emergence and strict caps`, async () => {
  const w = await load(tier, []), c = w.l7Encounters!, ai = w.infected!, cap = tier === 'high' ? 200 : 100;
  c.start();
  let peak = 0;
  for (let batch = 0; batch < 10 && ai.director.queue.length; batch++) {
    ai.director.update(); c.update(); peak = Math.max(peak, ai.director.count);
    expect(ai.director.count).toBeLessThanOrEqual(cap);
    expect(ai.active.every(e => ['infected.runner', 'infected.alpha'].includes(e.archetype))).toBe(true);
    if (!batch) {
      expect(c.state.finalReady).toBe(true);
      const final = ai.active.filter(e => e.infected!.pack === l7Encounters.finalGroup);
      expect(final.filter(e => e.archetype === 'infected.runner')).toHaveLength(tier === 'high' ? 120 : 60);
      expect(final.filter(e => e.archetype === 'infected.alpha')).toHaveLength(2);
      w.npcs!.civilians.outbreak!.dressInfected();
      expect(final.filter(e => e.archetype === 'infected.runner').every(e => e.appearance?.entityId === e.id)).toBe(true);
      // Downed regulars still own slots. A recovery cannot burst the cap.
      const down = ai.active.find(e => e.archetype === 'infected.runner')!;
      down.health.current = 0; down.infected!.recoverAt = w.tick + 120;
      ai.director.update(); expect(ai.director.count).toBe(cap);
    }
    for (const e of [...ai.active]) ai.release(e);
    if (!batch) teleport(w, 286, 15);
    w.tick++;
  }
  expect(peak).toBe(cap); expect(ai.director.queue).toHaveLength(0);
  expect(c.state.arrivals.filter(a => a.alpha)).toHaveLength(5);
  expect(c.state.arrivals.filter(a => !a.alpha)).toHaveLength(tier === 'high' ? 400 : 200);
  expect(c.state.arrivals.every(a => a.offscreen && a.safe)).toBe(true);
});
test('T-E29-08-visible @E29-AC08 visible final emergence stays queued with both Alphas', async () => {
  const w = await load('low', []), ai = w.infected!, c = w.l7Encounters!;
  c.start(); teleport(w, -64, 46); ai.director.update(); c.update();
  expect(c.state.finalReady).toBe(false);
  expect(ai.director.queue.filter(q => q.options.pack === 700 && q.archetype === 'infected.alpha')).toHaveLength(2);
  expect(ai.active.every(e => e.infected!.pack !== 700)).toBe(true);
});
test('T-E29-11-roster @E29-AC11 incoming ids, health, appearance and injury survive; 0–35 followers use bounded motion', async () => {
  const source = await load(), base = source.entities.get(source.l7Encounters!.state.roster[0].id)!;
  for (const count of [0, 1, 35]) {
    const incoming = Array.from({ length: count }, (_, i) => {
      const e = structuredClone(base); e.id = 40 + i; e.health.current = 21 + i;
      e.civilian!.survivor!.key = `carry-${i}`; e.civilian!.l1!.walkSpeed = i % 5 ? 2.2 : 1.4;
      return e;
    });
    const w = await load('high', incoming), c = w.l7Encounters!;
    expect(c.state.roster.map(r => r.id)).toEqual(incoming.map(e => e.id));
    for (const e of incoming) { expect(w.entities.get(e.id)!.health).toEqual(e.health); expect(w.entities.get(e.id)!.appearance).toEqual(e.appearance); }
    expect(w.entities.values().filter(e => e.hazard?.kind === 'fire')).toHaveLength(22);
    expect(c.state.roster.filter(r => r.injured)).toHaveLength(Math.ceil(count / 5));
    teleport(w, 258, 15);
    for (let i = 0; i < 60; i++) {
      const before = c.state.roster.map(r => ({ ...w.entities.get(r.id)!.transform })); step(w, 1);
      c.state.roster.forEach((r, j) => expect(Math.hypot(w.entities.get(r.id)!.transform.x - before[j].x, w.entities.get(r.id)!.transform.z - before[j].z)).toBeLessThanOrEqual(1));
    }
    expect(c.state.roster).toHaveLength(count);
  }
});
test('T-E29-11-L6-result @E29-AC11 L6 serializes effective injury speed without mutating the escaped resident', async () => {
  const source = await load(), r = source.l7Encounters!.state.roster[0];
  const e = source.entities.get(r.id)!; e.civilian!.l1!.walkSpeed = 2.2; e.health.current = 27;
  const mission = { world: source, state: { l6: { survivors: [{ id: e.id, key: r.key, injured: true, status: 'out' }] } } } as unknown as Mission;
  const result = new LevelSixSubway(mission).result();
  expect(result.escapedSurvivors[0].civilian!.l1!.walkSpeed).toBe(1.4);
  expect(e.civilian!.l1!.walkSpeed).toBe(2.2);
  const next = await load('low', result.escapedSurvivors);
  expect(next.l7Encounters!.state.roster[0]).toMatchObject({ id: e.id, key: r.key, injured: true });
  expect(next.entities.get(e.id)!.health.current).toBe(27);
  expect(next.entities.get(e.id)!.appearance).toEqual(e.appearance);
});
test('T-E29-11-stragglers @E29-AC11 cross-city followers use staggered partial routes and keep walking', async () => {
  const w = await load('low'), c = w.l7Encounters!, nav = w.infected!.nav;
  const starts = c.state.roster.map(r => ({ ...w.entities.get(r.id)!.transform }));
  const routes = new Set(c.state.roster.map(r => w.entities.get(r.id)!.civilian!.path));
  const searches = vi.spyOn(nav, 'path');
  teleport(w, -19, 0);
  for (let i = 0; i < 300; i++) {
    const before = c.state.roster.map(r => ({ ...w.entities.get(r.id)!.transform })); step(w, 1);
    c.state.roster.forEach((r, j) => expect(Math.hypot(w.entities.get(r.id)!.transform.x - before[j].x, w.entities.get(r.id)!.transform.z - before[j].z)).toBeLessThanOrEqual(1));
  }
  const followerSearches = searches.mock.calls.filter(call => routes.has(call[2]));
  expect(followerSearches.length).toBeLessThanOrEqual(c.state.roster.length * 10);
  expect(followerSearches.every(call => (call[3] ?? Infinity) <= 400)).toBe(true);
  c.state.roster.forEach((r, j) => expect(Math.hypot(w.entities.get(r.id)!.transform.x - starts[j].x, w.entities.get(r.id)!.transform.z - starts[j].z)).toBeGreaterThan(1));
  searches.mockRestore();
});
test('T-E29-11-loss @E29-AC11 combat losses are logged without deleting the roster', async () => {
  const w = await load(), c = w.l7Encounters!, [dead, turned] = c.state.roster;
  w.entities.get(dead.id)!.health.current = 0;
  w.npcs!.civilians.outbreak!.turnNow(w.entities.get(turned.id)!);
  c.update(); c.update();
  expect(dead.status).toBe('dead'); expect(turned.status).toBe('turned'); expect(c.state.roster).toHaveLength(24);
  expect(w.events.events().filter(e => e.type === 'mission.signal' && e.name.startsWith('l7.survivor-'))).toHaveLength(2);
});
test('T-E29-12 @E29-AC12 rocket opening is traversed by a living follower while street infected remain', async () => {
  const seed = await load(), base = structuredClone(seed.entities.get(seed.l7Encounters!.state.roster[0].id)!); base.id = 40;
  const w = await load('low', [base]), c = w.l7Encounters!, ai = w.infected!;
  c.start(); ai.director.update(); c.update();
  expect(c.state.finalReady).toBe(true);
  const follower = w.entities.get(base.id)!;
  Object.assign(follower.transform, { x: -53, z: 46, y: .7 }); w.spatial.set(follower.id, -53, 46);
  // Keep this deterministic blast/path fixture in place; ordinary AI remains covered by production movement tests.
  for (const e of ai.active) { e.combat!.staggerUntil = 10000; e.infected!.until = 10000; }
  teleport(w, -79, 46); w.entities.get(1)!.transform.yaw = Math.PI;
  // Two real E27 center blasts clear a 6m-wide strip and both Alphas without clearing the street groups.
  for (const x of [-70, -64, -58]) for (let shot = 0; shot < 2; shot++) { w.explosions!.blast('explosion.rocket', { x, z: 46 }, { sourceId: 1 }); step(w, 1); }
  for (let i = 0; i < 900 && !c.state.passageReady; i++) step(w, 1);
  expect(follower.transform.x).toBeLessThanOrEqual(-76);
  expect(c.state.roster[0].passed).toBe(true); expect(c.state.passageReady).toBe(true);
  expect(ai.active.filter(e => e.health.current > 0).length).toBeGreaterThanOrEqual(10);
  expect(w.getState().l7?.passageReady).toBe(true);
});
test('T-E29-16-encounters @E29-AC16 checkpoint seam retains queues, Alpha requests, identities and passage state', async () => {
  const w = await load('low'), c = w.l7Encounters!; c.start(); w.infected!.director.update(); c.update();
  const mission = w.loadMission({ id: 'L7', briefing: 'Encounter checkpoint fixture', anchors: { exit: { x: 273, z: 15, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: ['departed'], counters: [], checkpoints: ['corridor'], cinematics: {}, steps: [{ id: 'departure', type: 'custom', text: 'Board the bus', anchor: 'exit', start: { kind: 'start' }, complete: { kind: 'state', key: 'departed', equals: true }, fail: [] }], finish: ['departure'], onStart: [], onComplete: [] });
  mission.begin(); mission.checkpoint('corridor');
  const before = c.snapshot(), seams = captureSeams(w);
  w.tick += 120; w.infected!.director.queue.length = 0; c.state.roster[0].status = 'dead'; c.state.passageReady = true;
  restoreSeams(w, seams);
  expect(c.state.roster).toEqual(before.state.roster); expect(c.state.passageReady).toBe(false);
  expect(w.infected!.director.queue).toEqual(before.queue); expect(c.snapshot().seen).toEqual(before.seen);
  expect(w.infected!.director.strict).toBe(true);
  w.infected!.director.queue.length = 0; c.state.roster[0].status = 'dead';
  mission.restore('corridor');
  expect(c.state.roster).toEqual(before.state.roster); expect(w.infected!.director.queue).toEqual(before.queue);
  expect(w.infected!.active.map(e => e.id).sort((a, b) => a - b)).toEqual(before.state.arrivals.map(a => a.id).sort((a, b) => a - b));
  expect(w.entities.values().filter(e => e.hazard?.kind === 'fire')).toHaveLength(22);
});

test('T-E29-11-zero @E29-AC11 zero living survivors can reach passage without a kill-all requirement', async () => {
  const w = await load('low', []), c = w.l7Encounters!;
  c.start(); w.infected!.director.update(); c.update();
  teleport(w, -79, 46); c.update();
  expect(c.state.passageReady).toBe(true); expect(w.infected!.director.count).toBe(100);
});

for (const tier of ['high', 'low'] as const) test(`T-E29-19-dying @E29-AC19 ${tier}: rocket death animations retain active-pool slots`, async () => {
  const w = await load(tier, []), c = w.l7Encounters!, ai = w.infected!, cap = tier === 'high' ? 200 : 100;
  c.start(); ai.director.update(); c.update();
  expect(ai.active.length).toBe(cap);
  w.explosions!.blast('explosion.rocket', { x: -64, z: 46 }, { sourceId: 1 });
  step(w, 1);
  expect(ai.director.reserved).toBeGreaterThan(0);
  for (let i = 0; i < 180; i++) { step(w, 1); expect(ai.active.length).toBeLessThanOrEqual(cap); expect(ai.director.count).toBeLessThanOrEqual(cap); }
  expect(ai.active.length).toBe(cap);
});

test('T-E29-08-turning @E29-AC08 pending survivor transformations reserve a slot before queued arrivals', async () => {
  const w = await load('low'), c = w.l7Encounters!, ai = w.infected!;
  const targets = c.state.roster.slice(0, 3).map(r => w.entities.get(r.id)!);
  const appearances = targets.map(e => structuredClone(e.appearance));
  c.start();
  for (const request of ai.director.queue.filter(r => r.archetype === 'infected.runner').slice(0, 97)) ai.spawn('infected.runner', request.position, { state: 'idle' });
  for (const target of targets) {
    w.events.emit({ type: 'outbreak.bite', tick: w.tick, sourceId: ai.active[0].id, targetId: target.id, position: target.transform, turns: true });
    expect(target.infection).toBeDefined();
    c.update(); // The next bite must count previous pending transformations only once.
  }
  expect(ai.director.reserved).toBe(0); expect(ai.director.pendingTurns).toBe(3);
  ai.director.update(); expect(ai.active).toHaveLength(97);
  for (let i = 0; i < 240; i++) { step(w, 1); expect(ai.active.length).toBeLessThanOrEqual(100); }
  targets.forEach((target, i) => {
    expect(w.entities.get(target.id)!.infected).toBeDefined();
    expect(w.entities.get(target.id)!.appearance).toEqual(appearances[i]);
    expect(c.state.roster[i].status).toBe('turned');
  });
});
