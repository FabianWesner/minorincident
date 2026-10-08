import { afterEach, expect, test } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Matrix4 } from 'three';
import { NavGrid } from '../../../src/sim/ai/NavGrid';
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

test('T-E07-03c @E07 @E07-AC03 collider-baked AI navigation honors E10 offset ground bounds', async () => {
  const w = await arena('offset-horde'), ai = w.infected!; const e = w.entities.get(ai.spawn('infected.runner', { x: 95, z: 50 }, { state: 'chase' }))!;
  for (let i = 0; i < 450; i++) { w.update(); expect(ai.nav.clear(e.transform.x, e.transform.z, e.combat!.radius)).toBe(true); }
  expect(Math.hypot(e.transform.x - 105, e.transform.z - 50)).toBeLessThan(1.2); expect(w.entities.get(1)!.transform.y).toBeCloseTo(0.705, 2);
});


test('T-E07-02b @E07 @E07-AC02 @E06-AC04 actual infected consume catalog noise, with silent melee misses and bounded kill noise', async () => {
  const w = await arena();
  const near = w.entities.get(w.infected!.spawn('infected.runner', { x: 0, z: 5 }))!;
  const outside = w.entities.get(w.infected!.spawn('infected.runner', { x: 0, z: 7 }))!;
  const distant = w.entities.get(w.infected!.spawn('infected.runner', { x: 0, z: 24 }))!;
  const attack = () => { w.setInput({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 } }); step(w, 1); w.clearInput(); step(w, 30); };
  w.combat!.setLoadout(['weapon.bat'], ['weapon.grenade']); attack();
  expect(near.infected!.state).toBe('idle'); expect(w.events.events().filter((e) => e.type === 'noise')).toHaveLength(0);
  const victim = w.entities.get(w.infected!.spawn('infected.runner', { x: 1, z: 0 }))!; victim.health.current = 1;
  attack();
  expect(victim.health.current).toBe(0); expect(near.infected!.state).not.toBe('idle'); expect(outside.infected!.state).toBe('idle');
  expect(w.events.events().some((e) => e.type === 'ai.alerted' && e.targetId === near.id && e.cause === 'noise')).toBe(true);
  w.combat!.setLoadout(['weapon.hunting-rifle'], ['weapon.grenade']); attack();
  expect(distant.infected!.state).toBe('chase');
  expect(w.events.events().some((e) => e.type === 'ai.alerted' && e.targetId === distant.id && e.cause === 'noise')).toBe(true);
});


test('T-E07-07c @E07 @E07-AC07 scripted cats validate the actual selected perch before spawning', async () => {
  const w = await arena('animal-lab'), director = w.infected!.director;
  expect(director.safe('infected.cat', { x: 52, z: 0 })).toBe(false);
  director.request('infected.cat', { x: 52, z: 0 });
  director.request('infected.cat', { x: 52, z: 0 }, { perched: false }); step(w, 1);
  expect(w.infected!.active).toHaveLength(1); expect(w.infected!.active[0].transform.x).toBe(52); expect(director.queue).toHaveLength(1);
  const player = w.entities.get(1)!; player.transform.x = 52; w.physics.playerBody!.setTranslation(player.transform, true); step(w, 1);
  expect(director.queue).toHaveLength(0); expect(w.infected!.active).toHaveLength(2);
  const cat = w.infected!.active[1]; expect(cat.transform.x).toBe(5.1); expect(cat.transform.y).toBe(2.2);
  expect(director.visible(cat.transform)).toBe(false); expect(Math.hypot(cat.transform.x - 52, cat.transform.z)).toBeGreaterThanOrEqual(18);
  director.setFrustum(new Matrix4().makeScale(0.01, 1, 0.01).elements);
  expect(director.visible({ x: cat.transform.x, z: cat.transform.z, y: 0.7 })).toBe(true); expect(director.visible(cat.transform)).toBe(false);
});

test('@E19 prepared tier occupancy matches a full rebake after dynamic blockers change', () => {
  const walls = [{ x: 2, z: 0, y: 1, halfX: .6, halfZ: 2, halfY: 1 }];
  const grid = new NavGrid({ width: 20, depth: 20 }, walls), full = new NavGrid({ width: 20, depth: 20 }, walls);
  const door = { x: -2, z: 0, y: 1, halfX: .5, halfZ: 1, halfY: 1 }, cart = { ...door, x: -4, z: -3 };
  grid.setBlocker(1, door, true);
  const baked = grid.prepare(walls);
  grid.setBlocker(1, door, false); grid.setBlocker(2, cart, true); full.setBlocker(2, cart, true);
  grid.rebake(baked); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  grid.setBlocker(2, door, true); full.setBlocker(2, door, true); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
  grid.setBlocker(2, door, false); full.setBlocker(2, door, false); full.rebake(); expect(grid.blocked).toEqual(full.blocked);
});

test('@E07 melee ring: five infected hold 1.08 m from the courier yet keep landing hits (QA qa-courier-attack-bat pile-up)', async () => {
  const { meleeRing } = await import('../../../src/sim/ai/CharacterSeparation');
  const w = await arena(); w.combat!.damage.god = false;
  const player = w.entities.get(1)!, start = player.health.current;
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; w.infected!.spawn('infected.runner', { x: player.transform.x + Math.cos(a) * 3, z: player.transform.z + Math.sin(a) * 3 }, { state: 'chase' }); }
  let closest = Infinity, attacks = 0;
  for (let tick = 0; tick < 300; tick++) {
    w.update(); if (tick < 120) continue;
    for (const e of w.infected!.active) { closest = Math.min(closest, Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)); if (e.infected!.state === 'attack') attacks++; }
  }
  expect(meleeRing).toBeLessThan(1.1);   // inside the 1.1 m infected attack range
  expect(closest).toBeGreaterThan(meleeRing - .03);
  expect(attacks).toBeGreaterThan(100);
  expect(player.health.current).toBeLessThan(start);
});
