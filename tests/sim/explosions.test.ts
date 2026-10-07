import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { blastDamage, explosionDef } from '../../src/data/explosions';
import { massResponse } from '../../src/sim/combat/Explosions';
import type { GameEvent } from '../../src/sim/world/types';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'blast-lab'): Promise<SimWorld> { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name); w.combat!.damage.god = true; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
const events = <T extends GameEvent['type']>(w: SimWorld, type: T) => w.events.events().filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
function teleport(w: SimWorld, x: number, z: number) { const p = w.entities.get(1)!; Object.assign(p.transform, { x, z }); w.physics.playerBody!.setTranslation({ x, y: p.transform.y, z }, true); w.spatial.set(1, x, z); }

test('T-E27-02 @E27 @E27-AC02 per class the sim damage at 0 / 50 / 100 % radius matches the curve within 2 %', async () => {
  for (const id of ['explosion.pipe-bomb', 'explosion.propane', 'explosion.car', 'explosion.gas-tanks']) {
    const w = await world(), d = explosionDef(id), at = { x: 0, z: -18 };
    const ids = [0, .5, 1].map(f => w.spawnDummy('infected.dummy', { x: at.x + d.radius * f * (f === 1 ? .999 : 1), z: at.z }, { hp: 5000 }));
    w.explosions!.blast(id, at);
    [0, .5, .999].forEach((f, i) => {
      const expected = blastDamage(d, d.radius * f), dealt = 5000 - w.entities.get(ids[i])!.health.current;
      expect(Math.abs(dealt - expected), `${id} at ${f}`).toBeLessThanOrEqual(Math.max(.02 * expected, 1e-6));
    });
    expect(blastDamage(d, d.radius * .5)).toBeLessThan(blastDamage(d, 0));
  }
});
test('T-E27-02b @E27 @E27-AC02 @E26-AC05 the radial impulse has an upward bias, scales with mass and lands one tick later', async () => {
  const w = await world(), cone = w.props!.items.find(p => p.assetId === 'prop.traffic-cone')!, bench = w.props!.items.find(p => p.assetId === 'prop.bench')!;
  step(w, 30);
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 });
  expect(w.explosions!.pending.every(p => p.at === w.tick + 1)).toBe(true);
  expect(w.explosions!.pending.length).toBeGreaterThanOrEqual(10);
  expect(cone.body.linvel().y).toBeCloseTo(0, 3);
  step(w, 1);
  const v = cone.body.linvel(), out = (v.x * cone.pose.p[0] + v.z * cone.pose.p[2]) / Math.hypot(cone.pose.p[0], cone.pose.p[2]);
  expect(v.y).toBeGreaterThan(1); expect(out).toBeGreaterThan(.2); expect(v.y).toBeGreaterThan(out * 1.5);
  expect(w.explosions!.pending).toHaveLength(0);
  // Heavier bodies respond less (cones fly, benches tumble, cars hop).
  expect(massResponse(cone.mass)).toBeGreaterThan(massResponse(bench.mass)); expect(massResponse(1200)).toBeLessThan(.5);
  step(w, 20); expect(Math.max(...w.props!.items.filter(p => p.assetId === 'prop.traffic-cone').map(p => p.pose.p[1]))).toBeGreaterThan(.5);
});
test('T-E27-02c @E27 @E27-AC02 full cover shields a target; barricade rails take blast damage', async () => {
  const w = await world(), behind = w.spawnDummy('infected.dummy', { x: -7, z: 0 }, { hp: 500 }), open = w.spawnDummy('infected.dummy', { x: -1.5, z: 3.5 }, { hp: 500 });
  const rail = w.barricades!.spawn({ id: 'blast-rail', groupId: 'g', a: { x: 2, z: 2 }, b: { x: 4, z: 2 }, height: 1, initialHp: 300 });
  w.explosions!.blast('explosion.propane', { x: -4.5, z: 0 });
  expect(w.entities.get(behind)!.health.current).toBe(500); expect(w.entities.get(open)!.health.current).toBeLessThan(500);
  w.explosions!.blast('explosion.propane', { x: 3, z: 0 });
  expect(w.entities.get(rail)!.health.current).toBeCloseTo(300 - 100 * (5 - 2) / 5, 5);
});
test('T-E27-04 @E27 @E27-AC04 five propane tanks 3 m apart chain in sequence at 0.15–0.3 s per link; ≤ 8 links per second', async () => {
  const w = await world('combat-arena'), tanks = [-6, -3, 0, 3, 6].map(x => w.hazards!.spawn('propane', { x, z: 8 }));
  w.hazards!.hit(tanks[0], 100, 'bullet'); step(w, 200);
  const blasts = events(w, 'hazard.exploded');
  expect(blasts.map(e => e.id)).toEqual(tanks);
  for (let i = 1; i < blasts.length; i++) { const dt = (blasts[i].tick - blasts[i - 1].tick) / 60; expect(dt).toBeGreaterThanOrEqual(.15); expect(dt).toBeLessThanOrEqual(.3); }
  expect(events(w, 'explosion').filter(e => e.defId === 'explosion.propane')).toHaveLength(5);
  const big = await world('combat-arena'), stack = Array.from({ length: 14 }, (_, i) => big.hazards!.spawn('propane', { x: i * .2, z: 8 }));
  big.hazards!.hit(stack[0], 100, 'bullet'); step(big, 240);
  const ticks = events(big, 'hazard.exploded').map(e => e.tick);
  expect(ticks).toHaveLength(14);
  for (const t of ticks) expect(ticks.filter(u => u >= t && u < t + 60).length).toBeLessThanOrEqual(8);
});
test('T-E27-05 @E27 @E27-AC05 a car explosion lifts the body ≥ 0.5 m, detaches doors and hood, chars the wreck and leaves fires ≥ 20 s', async () => {
  const w = await world(), car = w.vehicles!.cars.values().next().value!, rest = car.physics.body.translation().y;
  step(w, 30); w.vehicles!.damage(car.entity.id, 1e6); step(w, 180);
  expect(events(w, 'vehicle.exploded')).toHaveLength(1);
  const blast = events(w, 'explosion').find(e => e.defId === 'explosion.car')!;
  expect(blast.cls).toBe('large');
  let top = rest;
  for (let i = 0; i < 60; i++) { step(w, 1); top = Math.max(top, car.physics.body.translation().y); }
  expect(top - rest).toBeGreaterThanOrEqual(.5);
  const parts = w.explosions!.snapshot().parts;
  expect(parts.length).toBeGreaterThanOrEqual(2); expect(parts.map(p => p.kind).sort()).toEqual(['door', 'door', 'hood']);
  expect(Math.max(...parts.map(p => Math.hypot(p.position.x - car.entity.transform.x, p.position.z - car.entity.transform.z)))).toBeGreaterThan(1.5);
  expect(car.entity.vehicle!.damage).toBe('exploded');
  step(w, 20 * 60);
  expect(w.entities.values().filter(e => e.hazard?.kind === 'fire' && w.tick < e.hazard.activeUntil).length).toBeGreaterThan(0);
  step(w, 1800); expect(w.explosions!.snapshot().parts).toHaveLength(0);
});
test('T-E27-06 @E27 @E27-AC06 gas-station mega: pump → canopy → tanks, ≥ 80 % kills in 12 m, slow-mo only within 15 m', async () => {
  const w = await world(), at = { x: 0, z: -16 }, ids: number[] = [];
  for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = 2 + (i % 5) * 2.2; ids.push(w.infected!.spawn('infected.runner', { x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r }, { state: 'idle' })); }
  w.explosions!.blast('explosion.gas-station', at); step(w, 60);
  expect(events(w, 'explosion').map(e => e.defId)).toEqual(['explosion.gas-pump', 'explosion.gas-canopy', 'explosion.gas-tanks']);
  const stageTicks = events(w, 'explosion').map(e => e.tick); expect(stageTicks[1]).toBeGreaterThan(stageTicks[0]); expect(stageTicks[2]).toBeGreaterThan(stageTicks[1]);
  const dead = ids.filter(id => (w.entities.get(id)?.health.current ?? 0) <= 0).length;
  expect(dead / ids.length).toBeGreaterThanOrEqual(.8);
  expect(events(w, 'explosion.slowmo')).toHaveLength(0); // player 26 m away
  const near = await world(); teleport(near, 0, -4);
  near.explosions!.blast('explosion.gas-station', at); step(near, 60);
  expect(events(near, 'explosion.slowmo')).toEqual([expect.objectContaining({ defId: 'explosion.gas-tanks', scale: .35, seconds: .6 })]);
});
test('T-E27-08 @E27 @E27-AC08 infected inside a 6 m smoke cloud lose their target within 0.5 s, wander, and the cloud ends at 12 s', async () => {
  const w = await world('smoke-lab'), ids = [0, 1, 2, 3, 4].map(i => w.infected!.spawn('infected.runner', { x: 2.5 + i * .6, z: -1 + i * .5 }, { state: 'chase' }));
  step(w, 2); expect(ids.every(id => w.entities.get(id)!.infected!.state !== 'idle')).toBe(true);
  w.combat!.setLoadout(['weapon.pistol'], ['weapon.smoke-grenade']);
  w.setInput({ aim: { x: 1, z: 0 }, aimPoint: { x: 1.5, z: 0 }, right: { down: true, held: true, up: false } }); step(w, 1); w.clearInput();
  let zone = w.combat!.effects.zones.find(z => z.kind === 'smoke');
  for (let i = 0; i < 60 && !zone; i++) { step(w, 1); zone = w.combat!.effects.zones.find(z => z.kind === 'smoke'); }
  expect(zone).toMatchObject({ radius: 6 }); const created = zone!.created;
  step(w, 30);
  const lost = events(w, 'ai.lostTarget');
  for (const id of ids) { const first = lost.find(e => e.sourceId === id); expect(first, `infected ${id}`).toBeDefined(); expect(first!.tick - created).toBeLessThanOrEqual(30); }
  const attacksBefore = events(w, 'infected.attack').length;
  step(w, created + 700 - w.tick);
  expect(ids.every(id => !['chase', 'attack'].includes(w.entities.get(id)!.infected!.state))).toBe(true);
  expect(events(w, 'infected.attack').length).toBe(attacksBefore);
  step(w, created + 719 - w.tick); expect(w.combat!.effects.inSmoke({ x: 1.5, z: 0 })).toBe(true);
  step(w, 1); expect(w.combat!.effects.inSmoke({ x: 1.5, z: 0 })).toBe(false);
  expect(w.combat!.effects.smokeBlocks(w.entities.get(ids[0])!.transform, w.entities.get(1)!.transform)).toBe(false);
});
test('T-E27-fires @E27 aftermath fires damage, spread once under the cap and burn out', async () => {
  const w = await world('combat-arena');
  w.explosions!.blast('explosion.barrel', { x: 8, z: 8 });
  const fires = () => w.entities.values().filter(e => e.hazard?.kind === 'fire' && w.tick < e.hazard.activeUntil);
  expect(fires()).toHaveLength(3);
  const victim = w.spawnDummy('infected.dummy', { x: fires()[0].transform.x, z: fires()[0].transform.z }, { hp: 500 });
  step(w, 18 * 30 + 2); expect(fires().length).toBeGreaterThan(3); expect(w.entities.get(victim)!.health.current).toBeLessThan(500);
  step(w, 30 * 60); expect(fires()).toHaveLength(0);
});

// Later E27 increments (staging §6: core first). Kept as named placeholders so the criteria stay traceable.
test.skip('T-E27-09 @E27-AC09 deferred: toxic and tear gas variants (DoT, Hazmat immunity, 30 % / 15 % slows)', () => {});
test.skip('T-E27-10 @E27-AC10 deferred: fire extinguisher prop burst (extinguish within 3 m, 1 s cone stun)', () => {});
test.skip('T-E27-11 @E27-AC11 deferred: night smoke lit by the E25 light field and siren strobes (needs E25 light field)', () => {});
test.skip('T-E27-12 @E27-AC12 deferred: player rim silhouette under smoke; core only dims puffs in the shared see-through hole', () => {});
test.skip('T-E27-13 @E27-AC13 deferred: L6 l6-overview columns and column shadow strips (needs L6 content)', () => {});
test.skip('T-E27-15 @E27-AC15 deferred: vision checklist H review (orchestrator)', () => {});
