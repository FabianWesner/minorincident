import { afterEach, expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SimWorld } from '../../../src/sim/world/SimWorld';
import { humanInfected, validateInfected } from '../../../src/data/infected';
const worlds: SimWorld[] = [];
async function arena(name = 'horde-arena') { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name); w.combat!.damage.god = true; return w; }
function step(w: SimWorld, count: number) { for (let i = 0; i < count; i++) w.update(); }
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });
test('T-E07-01 @E07 @E07-AC01 all twelve human roles validate and spawn', async () => {
  validateInfected(); expect(humanInfected).toHaveLength(12); expect(() => validateInfected([{ ...humanInfected[0], windup: 0.1 }])).toThrow();
  const w = await arena(); for (const [i, def] of humanInfected.entries()) { const e = w.entities.get(w.infected!.spawn(def.id, { x: i * 2 - 12, z: 10 }))!; expect(e.health.current).toBe(def.hp); expect(e.infected!.speed).toBe(def.speed); }
});
test('T-E07-02 @E07 @E07-AC02 sight cone and facing-independent gunshot perception', async () => {
  const w = await arena();
  const inside = w.infected!.spawn('infected.runner', { x: -10, z: 0 });
  const outside = w.infected!.spawn('infected.runner', { x: 10, z: 0 });
  const far = w.infected!.spawn('infected.runner', { x: -15, z: 0 });
  const angle = w.infected!.spawn('infected.runner', { x: -5, z: 10 }); step(w, 18);
  expect(w.entities.get(inside)!.infected!.state).toBe('chase'); for (const id of [outside, far, angle]) expect(w.entities.get(id)!.infected!.state).toBe('idle');
  w.combat!.setLoadout(['weapon.pistol'], ['weapon.grenade']); w.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(w, 1); w.clearInput(); step(w, 17); for (const id of [outside, far, angle]) expect(w.entities.get(id)!.infected!.state).toBe('chase');
});
test('T-E07-03 @E07 @E07-AC03 maze path covers 40 m without crossing static colliders in 15 s', async () => {
  const w = await arena('maze'); expect(w.infected!.navigation.districts).toHaveLength(3); const e = w.entities.get(w.infected!.spawn('infected.runner', { x: -20, z: 0 }, { state: 'chase' }))!;
  for (let i = 0; i < 900; i++) { w.update(); expect(w.infected!.nav.clear(e.transform.x, e.transform.z, e.combat!.radius)).toBe(true); }
  expect(Math.hypot(e.transform.x - 20, e.transform.z)).toBeLessThan(1.2);
});
test('T-E07-04 @E07 @E07-AC04 spatial separation keeps deep overlaps below 2 percent', async () => {
  const w = await arena(); for (let i = 0; i < 100; i++) w.infected!.spawn('infected.runner', { x: (i % 10 - 5) * 0.8, z: 8 + Math.floor(i / 10) * 0.8 }, { state: 'chase' });
  let overlap = 0;
  for (let tick = 0; tick < 600; tick++) { w.update(); const entities = w.infected!.active; for (let i = 0; i < entities.length; i++) for (let j = i + 1; j < entities.length; j++) if (Math.hypot(entities[i].transform.x - entities[j].transform.x, entities[i].transform.z - entities[j].transform.z) < 0.5 * (entities[i].combat!.radius + entities[j].combat!.radius)) overlap++; }
  const share = overlap / (600 * 4950); expect(share).toBeLessThan(0.02);
  mkdirSync('test-results/epics/E07', { recursive: true }); writeFileSync('test-results/epics/E07/separation.json', JSON.stringify({ ticks: 600, infected: 100, pairsPerTick: 4950, averageDeepOverlapShare: share, budget: 0.02 }, null, 2) + '\n');
});

test('T-E07-03b @E07 @E07-AC03 grid A* resumes unfinished work without exceeding its per-tick budget', async () => {
  const w = await arena('maze'), nav = w.infected!.nav, result: number[] = []; let complete = false;
  for (let tick = 0; tick < 500 && !complete; tick++) { complete = nav.path(nav.cell(-20, 0), nav.cell(20, 0), result, 10); expect(nav.expansions).toBeLessThanOrEqual(10); }
  expect(complete).toBe(true); expect(result.length).toBeGreaterThan(80); for (const cell of result) expect(nav.blocked[cell]).toBe(0);
});
