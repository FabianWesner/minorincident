import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { compositions } from '../../src/levels/compositions';
import { resolveCampaignMission } from '../../src/levels/missions';
import { crossing, crossingChunks } from '../../src/levels/L9/district';
import { l9Encounters, l9Groups } from '../../src/data/l9';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';

const layout = JSON.parse(readFileSync('public/assets/layouts/D-CROSSING.layout.json', 'utf8')) as DistrictLayout;
async function load(tier: 'high' | 'low' = 'high') {
  const w = new SimWorld(); await w.init(); w.loadComposition(compositions.L9, [layout], 31);
  w.chunks!.setQuality(tier);
  const m = w.loadMission(resolveCampaignMission('L9', w.districts!)); m.begin();
  return { w, m };
}
function distanceToPath(p: Point, path: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - az) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(p[0] - ax - dx * t, p[1] - az - dz * t));
  }
  return best;
}

test('T-E31-05-groups @E31-AC05 @E31-AC11 groups sit on every risk anchor; the shortcut has 3x the road risk; every group is avoidable', async () => {
  const count = (route: string) => l9Groups.filter(g => g.route === route).length;
  expect([count('road'), count('countryside'), count('dry-shortcut')]).toEqual([2, 3, 6]);
  expect(count('dry-shortcut')).toBeGreaterThanOrEqual(2 * count('road'));
  expect(l9Groups.reduce((n, g) => n + g.runners + g.alphas, 0)).toBeLessThanOrEqual(100);
  const { w } = await load();
  try {
    for (const g of l9Groups) {
      const route = crossing.routes.find(r => r.id === g.route)!;
      expect(distanceToPath(g.at, route.points), `${g.id} stands on its route`).toBeLessThan(1);
      expect(distanceToPath(g.at, route.detour), `${g.id} is avoidable by the detour`).toBeGreaterThanOrEqual(l9Encounters.avoidM);
      expect(crossingChunks.some(c => g.at[0] >= c.origin[0] && g.at[0] < c.max[0] && g.at[1] >= c.origin[1] && g.at[1] < c.max[1])).toBe(true);
      // The blob centre is open ground, so no member is ever placed inside scenery.
      expect(w.districts!.nav.walkable(g.at), `${g.id} anchor walkable`).toBe(true);
    }
  } finally { w.dispose(); }
});

test('T-E31-12-groups @E31-AC12 @E31-AC13 groups spawn once on first residency, keep ids/HP on revisit and restore from a checkpoint without duplicates', async () => {
  const { w, m } = await load();
  try {
    const first = l9Groups.find(g => g.id === 'dry-shortcut-1')!, st = m.l9!.state;
    const car = w.vehicles!.cars.get(st.carId)!;
    car.physics.body.setTranslation({ x: first.at[0] - 30, y: 1, z: first.at[1] }, true);
    for (let i = 0; i < 40; i++) w.update();
    const ids = st.encounters!.ids[first.id];
    expect(ids).toHaveLength(first.runners + first.alphas);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(w.entities.get(id)?.infected, `${id} awake`).toBeTruthy();
    expect(w.infected!.director.count).toBeLessThanOrEqual(w.infected!.director.cap);
    m.checkpoint('outskirts-approach');
    w.entities.get(ids[0])!.health.current = 7;
    // Away for a while: records sleep, nothing respawns when the chunk is resident again.
    car.physics.body.setTranslation({ x: -540, y: 1, z: 0 }, true);
    for (let i = 0; i < 40; i++) w.update();
    expect(w.entities.get(ids[0])).toBeUndefined();
    car.physics.body.setTranslation({ x: first.at[0] - 30, y: 1, z: first.at[1] }, true);
    for (let i = 0; i < 60; i++) w.update();
    expect(st.encounters!.ids[first.id]).toEqual(ids);
    expect(w.entities.get(ids[0])!.health.current).toBe(7);
    expect(w.infected!.active.filter(e => ids.includes(e.id))).toHaveLength(ids.length);
    // A retry from the checkpoint taken after the spawn keeps the group (no duplicates) with its checkpointed health.
    m.restore('outskirts-approach');
    expect(m.l9!.state.encounters!.ids[first.id]).toEqual(ids);
    expect(w.infected!.active.filter(e => ids.includes(e.id))).toHaveLength(ids.length); expect(w.entities.get(ids[0])!.health.current).toBeGreaterThan(7);
    // The start checkpoint predates the spawn: the ledger resets together with the entities.
    m.restore('crossing-start');
    expect(m.l9!.state.encounters!.spawned).not.toContain(first.id);
    expect(w.infected!.active.filter(e => e.infected && e.transform.x > first.at[0] - 20 && e.transform.x < first.at[0] + 20)).toHaveLength(0);
  } finally { w.dispose(); }
}, 120_000);

interface RunResult { hp: number; min: number; contacts: number; zeroAt: number | null; zeroTick: number; speedAtZero: number; phases: string[]; ticks: number; maxCount: number; maxResident: number; exploded: number }
/** One-seed bot drive of a whole route (or its detour) through the forced crash. `zeroAt` is a fixture: the share of the route after which the APC is set to 0 durability. */
async function drive(route: string, opts: { detour?: boolean; zeroAt?: number; tier?: 'high' | 'low' } = {}): Promise<RunResult> {
  const { w, m } = await load(opts.tier);
  try {
    const l9 = m.l9!, bot = new LevelNineBot(w, route, opts.detour);
    const car = () => w.vehicles!.cars.get(l9.state.carId)!;
    const r: RunResult = { hp: 1000, min: 1000, contacts: 0, zeroAt: null, zeroTick: 0, speedAtZero: 0, phases: [], ticks: 0, maxCount: 0, maxResident: 0, exploded: 0 };
    w.events.on('vehicle.durability-hit', e => { if (e.type === 'vehicle.durability-hit' && e.source === 'contact') r.contacts++; });
    w.events.on('vehicle.exploded', () => r.exploded++);
    for (; r.ticks < 60 * 260 && !l9.state.finished; r.ticks++) {
      w.applyInput(bot.sample(), 'keyboard');
      if (opts.zeroAt !== undefined && r.zeroAt === null && l9.state.phase === 'driving' && bot.progress() >= opts.zeroAt) {
        w.vehicles!.damage(l9.state.carId, 1000); r.zeroAt = bot.progress(); r.zeroTick = r.ticks;
      }
      w.update();
      if (!r.phases.length || r.phases.at(-1) !== l9.state.phase) r.phases.push(l9.state.phase);
      // The cap damps overspeed within a few seconds; measure what the car sustains afterwards.
      if (r.zeroAt !== null && l9.state.phase === 'driving' && r.ticks > r.zeroTick + 420) r.speedAtZero = Math.max(r.speedAtZero, car().physics.speed);
      r.min = Math.min(r.min, w.entities.get(l9.state.carId)!.health.current);
      r.maxCount = Math.max(r.maxCount, w.infected!.director.count);
      if (r.ticks % 60 === 0) r.maxResident = Math.max(r.maxResident, w.chunks!.stats().resident);
    }
    r.hp = l9.state.preCrashDurability;
    expect(l9.state.finished, `${route} finished at ${car().entity.transform.x},${car().entity.transform.z} phases ${r.phases}`).toBe(true);
    expect(w.entities.get(1)!.health.current).toBeGreaterThanOrEqual(1);
    return r;
  } finally { w.dispose(); }
}
const route = (id: string) => crossing.routes.find(r => r.id === id)!;
const crash = ['driving', 'approach', 'fall', 'impact', 'crawl', 'done'];

for (const r of crossing.routes) test(`T-E31-11-${r.id} @E31-AC11 preserved-HP detour keeps full durability and reaches the forced crash`, async () => {
  const run = await drive(r.id, { detour: true });
  expect(run.hp).toBe(1000); expect(run.contacts).toBe(0); expect(run.exploded).toBe(1); expect(run.phases).toEqual(crash);
  expect(run.maxCount).toBeLessThanOrEqual(200); expect(run.maxResident).toBeLessThanOrEqual(25);
}, 300_000);

for (const r of crossing.routes) test(`T-E31-11-risk-${r.id} @E31-AC11 driving through the groups costs durability and still reaches the same crash`, async () => {
  const run = await drive(r.id);
  expect(run.contacts).toBeGreaterThan(0); expect(run.hp).toBeLessThan(1000); expect(run.exploded).toBe(1); expect(run.phases).toEqual(crash);
  expect(run.maxCount).toBeLessThanOrEqual(200);
}, 300_000);

for (const [name, at] of [['early', l9Encounters.fixtures.earlyZero], ['late', l9Encounters.fixtures.lateZero]] as const) {
  for (const r of crossing.routes) test(`T-E31-11-${name}-zero-${r.id} @E31-AC09 @E31-AC11 ${name} zero (${at * 100}% progress) keeps driving at 60% speed and reaches the same crash`, async () => {
    const run = await drive(r.id, { zeroAt: at });
    expect(run.zeroAt).not.toBeNull(); expect(run.zeroAt!).toBeGreaterThanOrEqual(at);
    expect(run.min).toBe(0); expect(run.hp).toBe(0); expect(run.exploded).toBe(1); expect(run.phases).toEqual(crash);
    // Zero HP is capped at 60% of the healthy 18 m/s road cap (+2%), and the APC keeps moving until the crash.
    expect(run.speedAtZero).toBeGreaterThan(3); expect(run.speedAtZero).toBeLessThanOrEqual(18 * .6 * 1.02 + .3);
  }, 300_000);
}

test('T-E31-11-compare @E31-AC11 the risky dry shortcut ends with less durability than the safe detour of the same route', async () => {
  const safe = await drive('dry-shortcut', { detour: true }), risky = await drive('dry-shortcut');
  expect(safe.hp).toBeGreaterThan(risky.hp);
  expect(route('dry-shortcut').risks.length).toBeGreaterThanOrEqual(2 * route('road').risks.length);
}, 300_000);

test('T-E31-12-low @E31-AC12 low tier keeps the shortcut inside the 100-infected and 9-chunk budgets', async () => {
  const run = await drive('dry-shortcut', { tier: 'low' });
  expect(run.maxCount).toBeLessThanOrEqual(100); expect(run.maxResident).toBeLessThanOrEqual(9); expect(run.phases).toEqual(crash);
}, 300_000);
