import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { MAX_AWAKE_PROPS } from '../../src/sim/interact/PropSystem';
import { infectedDef } from '../../src/data/infected';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'barricade-lab', seed = 1) { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name, seed); w.combat!.damage.god = true; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function teleport(w: SimWorld, x: number, z: number) { const p = w.entities.get(1)!; Object.assign(p.transform, { x, z, y: .705 }); w.physics.playerBody!.setTranslation(p.transform, true); w.player!.locomotion.reset(); w.spatial.set(1, x, z); }
function slot(w: SimWorld, id = 'door') { return w.entities.values().find(e => e.barricade?.slot.id === id)!; }

test('T-E26-02 @E26-AC02 prop-yard 300 authored bodies sleep after 1s without interaction', async () => {
  const w = await world('prop-yard'); step(w, 60);
  expect(w.props!.items).toHaveLength(300); expect(w.props!.items.filter(p => p.awake)).toHaveLength(0);
});
test('T-E26-06 @E26-AC06 staged awake budget freezes farthest props after waking 250', async () => {
  const w = await world('prop-yard'); for (const p of w.props!.items.slice(0, 250)) { p.body.setLinvel({ x: 1, y: 0, z: 0 }, true); }
  w.props!.postPhysics(); const awake = w.props!.items.filter(p => p.awake); expect(awake).toHaveLength(MAX_AWAKE_PROPS);
  const player = w.entities.get(1)!.transform, distance = (p: typeof awake[number]) => Math.hypot(p.pose.p[0] - player.x, p.pose.p[2] - player.z);
  expect(Math.max(...awake.map(distance))).toBeLessThanOrEqual(Math.min(...w.props!.items.slice(0, 250).filter(p => !p.awake).map(distance)) + .001);
});
test('T-E26-07 @E26-AC07 fallen props recover above ground at their displaced position within one tick', async () => {
  const w = await world('prop-yard'), p = w.props!.items[0], id = p.entityId, hp = w.entities.get(id)!.health.current;
  // PO retain-body change (713c48cd): escaped props keep their location/identity instead of snapping home or disappearing.
  p.body.setTranslation({ x: 10, y: -6, z: 3 }, true); w.props!.postPhysics();
  expect(p.pose.p).toEqual([10, Math.fround(Math.hypot(...p.half) * 2), 3]); expect(p.pose.q).toEqual(p.home.q);
  expect(p.entityId).toBe(id); expect(w.entities.get(id)!.health.current).toBe(hp); expect(p.body.isEnabled()).toBe(true); expect(p.body.isSleeping()).toBe(false);
});
test('T-E26-09 @E26-AC09 coverage rejects overlaps and low fill; 1.5s brace pins props and blocks navigation', async () => {
  const w = await world(), e = slot(w), p = w.props!.items[0];
  w.props!.place(p, { p: [0, 0, 12], q: p.home.q }); step(w, 1); expect(e.barricade!.coverage).toBe(0); expect(e.interactable!.enabled).toBe(false);
  w.props!.place(p, p.home); teleport(w, 0, 1.3); step(w, 1); expect(e.barricade!.coverage).toBeGreaterThanOrEqual(.8);
  step(w, 88); expect(w.barricades!.barricadeIntact('door')).toBe(false); step(w, 1);
  expect(w.barricades!.barricadeIntact('door')).toBe(true); expect(e.health.max).toBe(p.metadata.barricadeHP); expect(p.body.isKinematic()).toBe(true);
  expect(w.infected!.nav.clear(0, 0, .2)).toBe(false); expect(w.barricades!.allBarricaded('defense')).toBe(false);
});
test('T-E26-10 @E26-AC10 ten spaced runners deal defined DPS; Brute fivefold; breaking releases props and nav in the same tick', async () => {
  const w = await world(); teleport(w, 0, 1.3); step(w, 90);
  const e = slot(w), siege = await world('horde-arena'); teleport(siege, 0, 8);
  const railId = siege.barricades!.spawn({ id: 'wide-gate', groupId: 'siege', a: { x: -60, z: 0 }, b: { x: 60, z: 0 }, height: 1, initialHp: 400 });
  const rail = siege.entities.get(railId)!;
  for (let i = 0; i < 10; i++) siege.infected!.spawn('infected.runner', { x: (i - 4.5) * .8, z: -1.2 }, { state: 'chase' });
  step(siege, Math.ceil(infectedDef('infected.runner').windup * 60) + 1);
  expect(rail.health.current).toBeCloseTo(400 - 10 * infectedDef('infected.runner').damage, 5);
  const period = 60 + Math.ceil(infectedDef('infected.runner').windup * 60) + 1;
  step(siege, period * 2); expect(rail.health.current).toBeCloseTo(400 - 30 * infectedDef('infected.runner').damage, 5);
  step(siege, period); expect(siege.barricades!.barricadeIntact('wide-gate')).toBe(false);
  const brute = siege.infected!.spawn('infected.brute', { x: 0, z: -1 }, { state: 'chase' }); expect(siege.infected!.barricadeDamage(brute, 10)).toBe(50);
  w.hazards!.hit(e.id, 400, 'bullet');
  expect(w.barricades!.barricadeIntact('door')).toBe(false); expect(w.infected!.nav.clear(0, 0, .2)).toBe(true);
  expect(w.props!.items[0].body.isDynamic()).toBe(true); expect(w.props!.items[0].body.linvel().z).toBeGreaterThan(0); expect(w.props!.items[0].body.linvel().y).toBeGreaterThan(0);
  expect(w.events.events().filter(e => e.type === 'barricade.broken')).toHaveLength(1);
});
test('T-E26-12 @E26-AC12 stand 2s boards 200HP; repairs 25% per 2s; moving interrupts progress', async () => {
  const w = await world(); teleport(w, 0, 9.3); step(w, 119); expect(w.barricades!.barricadeIntact('window')).toBe(false);
  step(w, 1); const e = slot(w, 'window'); expect(e.health).toEqual({ current: 200, max: 200 });
  w.hazards!.hit(e.id, 120, 'bullet'); step(w, 120); expect(e.health.current).toBe(130);
  w.setInput({ move: { x: 1, z: 0 } }); step(w, 12); expect(e.health.current).toBe(130); expect(e.interactable!.progress).toBe(0);
  w.setInput({ move: { x: 0, z: 0 } }); teleport(w, 0, 9.3); step(w, 120); expect(e.health.current).toBe(180);
});
test('E26 restore reconciles intact and broken braces with entity checkpoints', async () => {
  const w = await world(); teleport(w, 0, 1.3); step(w, 90);
  const saved = structuredClone(w.entities.values()), poses = w.props!.snapshot(), e = slot(w);
  w.hazards!.hit(e.id, 1000, 'bullet'); w.entities.restore(saved, w.entities.get(1)!); w.props!.restore(poses); w.interactables!.rebuildBlockers(); w.barricades!.rebuild();
  expect(slot(w).barricade!.intact).toBe(true); expect(w.props!.items[0].body.isKinematic()).toBe(true); expect(w.infected!.nav.clear(0, 0, .2)).toBe(false);
});
test('T-E26-03 @E26-AC03 authored 35kg medium push slows to 55%; heavy requires shoulder upgrade', async () => {
  const w = await world(), medium = w.props!.items[0];
  expect(medium.mass).toBe(35); teleport(w, 0, -medium.radius - .4);
  const input = { ...w.inputFrame, move: { x: 0, z: 1 } };
  expect(w.props!.pushSpeed(input)).toBe(.55); expect(medium.body.linvel().z).toBeGreaterThan(0);
  w.setInput({ move: { x: 0, z: 1 } }); step(w, 30);
  expect(medium.pose.p[2]).toBeGreaterThan(medium.home.p[2] + .2);
  expect(Math.hypot(w.player!.locomotion.velocity.x, w.player!.locomotion.velocity.z)).toBeCloseTo(4.5 * .55, 1);
  w.clearInput();
  const heavy = w.props!.spawn({ id: 'heavy', assetId: 'prop.dumpster', position: [0, 0, 12], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [0, 0, 0], max: [1, 1, 1] } });
  teleport(w, 0, 12 - heavy.radius - .4); expect(w.props!.pushSpeed(input)).toBe(1); expect(heavy.body.isFixed()).toBe(true);
  w.props!.shoulderPush = true; expect(w.props!.pushSpeed(input)).toBe(.25); expect(heavy.body.isDynamic()).toBe(true); expect(heavy.body.linvel().z).toBeGreaterThan(0);
});
test('E26 a short detour goes around intact rails; long detours attack and break invalidates cached routes', async () => {
  const w = await world('horde-arena'), id = w.barricades!.spawn({ id: 'short', groupId: 'test', a: { x: -1, z: 0 }, b: { x: 1, z: 0 }, height: 1, initialHp: 400 });
  const runnerId = w.infected!.spawn('infected.runner', { x: 0, z: -1.3 }, { state: 'chase' }), runner = w.entities.get(runnerId)!;
  expect(w.barricades!.attackTarget(runner, { x: 0, z: 12 })).toBeUndefined();
  runner.infected!.path.push(3, 4); w.hazards!.hit(id, 400, 'bullet'); expect(runner.infected!.path).toHaveLength(0); expect(w.barricades!.barricadeIntact('short')).toBe(false);
});

function prop(w: SimWorld, assetId: string, x: number, z: number, id = assetId) {
  return w.props!.spawn({ id, assetId, position: [x, 0, z], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '', visualAabb: { min: [0, 0, 0], max: [1, 1, 1] } });
}
test('T-E26-04 @E26 @E26-AC04 real kick launches cone at 6m/s and momentum downs a runner', async () => {
  const w = await world(), cone = prop(w, 'prop.traffic-cone', -10, 0);
  teleport(w, -11, 0); w.combat!.setLoadout(['weapon.kick'], ['weapon.fists']);
  w.setInput({ aim: { x: 1, z: 0 }, left: { held: true, down: true, up: false } });
  let launched = false;
  for (let i = 0; i < 60; i++) {
    step(w, 1); const v = cone.body.linvel();
    if (v.x > 4) { expect(v.x).toBeGreaterThanOrEqual(5.5); expect(v.x).toBeLessThanOrEqual(6.5); expect(Math.abs(v.z)).toBeLessThan(.1); launched = true; break; }
  }
  expect(launched).toBe(true); w.clearInput();
  const runner = w.entities.get(w.infected!.spawn('infected.runner', { x: cone.pose.p[0] + cone.radius + .3, z: cone.pose.p[2] }, { state: 'idle' }))!;
  step(w, 12);
  expect(w.events.events().some(e => e.type === 'combat.hit' && e.targetId === runner.id && e.cause === 'prop' && e.amount > 0)).toBe(true);
  expect(runner.combat!.reaction!.heavy).toBe(true); expect(runner.combat!.staggerUntil).toBeGreaterThan(w.tick);
});
test('T-E26-05 @E26 @E26-AC05 blast impulse is delayed, upward and linear; outside radius stays asleep', async () => {
  const w = await world('prop-yard'), cones = [1, 2, 6].map((x, i) => prop(w, 'prop.traffic-cone', x, -35, `falloff-${i}`));
  w.props!.settle();
  w.explosions!.blast('explosion.propane', { x: 0, z: -35 }, { damage: false });
  const pending = cones.map(p => w.explosions!.pending.find(i => i.body === p.body));
  expect(pending[0]!.at).toBe(w.tick + 1); expect(pending[0]!.y).toBeGreaterThan(0);
  expect(pending[1]!.y / pending[0]!.y).toBeCloseTo((1 - 2 / 5) / (1 - 1 / 5), 5);
  expect(pending[2]).toBeUndefined(); expect(cones.every(p => p.body.isSleeping())).toBe(true);
  step(w, 1); expect(cones[0].body.linvel().y).toBeGreaterThan(0); expect(cones[2].body.isSleeping()).toBe(true);
});
test('T-E26-06b @E26 @E26-AC06 explosion wakes 250 bodies within both tier limits, farthest freeze first', async () => {
  const w = await world('prop-yard');
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { radius: 100, damage: false });
  expect(w.explosions!.pending.length).toBeGreaterThanOrEqual(250); step(w, 1);
  const awake = w.props!.items.filter(p => p.awake); expect(awake.length).toBeGreaterThan(0); expect(awake.length).toBeLessThanOrEqual(60); expect(awake.length).toBeLessThanOrEqual(150);
  const player = w.entities.get(1)!.transform, d = (p: typeof awake[number]) => Math.hypot(p.pose.p[0] - player.x, p.pose.p[2] - player.z);
  expect(Math.max(...awake.map(d))).toBeLessThanOrEqual(Math.min(...w.props!.items.filter(p => !p.awake).map(d)) + .01);
});
test('T-E26-07b @E26 @E26-AC07 remove flag disables a fallen prop without respawning it', async () => {
  const w = await world('prop-yard'), p = w.props!.items[1]; p.metadata = { ...p.metadata, reset: 'remove' };
  p.body.setTranslation({ x: 5, y: -6, z: 5 }, true); w.props!.postPhysics();
  expect(p.body.isEnabled()).toBe(false); expect(w.entities.get(p.entityId)!.health.current).toBe(0); expect(p.awake).toBe(false);
});
test('T-E26-08 @E26 @E26-AC08 displaced resting dumpster updates nav in 0.5s, short routes detour and long routes attack', async () => {
  const w = await world('horde-arena'); w.props = new (await import('../../src/sim/interact/PropSystem')).PropSystem(w);
  const p = prop(w, 'prop.dumpster', 10, 0); w.props.place(p, { p: [0, 0, 0], q: p.home.q });
  for (let i = 0; i < 30; i++) { step(w, 1); w.props.postPhysics(); }
  expect(w.infected!.nav.clear(0, 0, .2)).toBe(false);
  const runner = w.entities.get(w.infected!.spawn('infected.runner', { x: 0, z: -2 }, { state: 'chase' }))!;
  expect(w.barricades!.attackTarget(runner, { x: 0, z: 15 })).toBeUndefined();
  expect(w.barricades!.attackTarget(runner, { x: 0, z: 2 })).toBe(w.entities.get(p.entityId));
  runner.transform.z = -4;
  expect(w.barricades!.withinReach(runner, w.entities.get(p.entityId)!)).toBe(false);
  expect(w.barricades!.approach(runner, w.entities.get(p.entityId)!).z).toBeGreaterThan(-4);
  w.combat!.damage.apply({ sourceId: runner.id, targetId: p.entityId, attackId: 1, actionId: runner.archetype, origin: runner.transform, direction: { x: 0, z: 1 }, base: 10000, multiplier: 1, type: 'melee', knockback: 0, stagger: 0 });
  step(w, 30); w.props.postPhysics(); expect(w.infected!.nav.clear(0, 0, .2)).toBe(true);
});
test('T-E26-11 @E26 @E26-AC11 runners vault low sandbags in 1.2s; crawlers/heavies cannot; cover stops front shots', async () => {
  const w = await world('horde-arena'); teleport(w, 0, 8);
  const id = w.barricades!.spawn({ id: 'sandbag', groupId: 'cover', a: { x: -60, z: 0 }, b: { x: 60, z: 0 }, height: .8, sandbag: true, initialHp: 400 });
  const runner = w.entities.get(w.infected!.spawn('infected.runner', { x: 0, z: -1.2 }, { state: 'chase' }))!;
  const wall = w.entities.get(id)!;
  for (const type of ['infected.crawler', 'infected.brute']) {
    const e = w.entities.get(w.infected!.spawn(type, { x: 5, z: -1.2 }, { state: 'chase' }))!;
    expect(w.barricades!.vault(e, wall)).toBe(false); expect(e.infected!.vault).toBeUndefined();
  }
  step(w, 1); const started = runner.infected!.vault!.started; step(w, 71);
  expect(w.tick - started).toBe(71); expect(runner.infected!.vault).toBeDefined();
  step(w, 1); expect(runner.infected!.vault).toBeUndefined(); expect(runner.transform.z).toBeGreaterThan(.7); expect(runner.transform.y).toBeCloseTo(.7);
  expect(w.combat!.query.clearDistance({ x: 0, z: -3 }, { x: 0, z: 1 }, 12)).toBeLessThan(3);
  expect(w.combat!.query.visible({ x: 0, z: -3 }, w.entities.get(1)!.transform)).toBe(false);
  w.combat!.damage.god = false; const hp = w.entities.get(1)!.health.current;
  for (const type of ['bullet', 'projectile'] as const) expect(w.combat!.damage.apply({ sourceId: runner.id, targetId: 1, attackId: 100, actionId: 'cover.probe', origin: { x: 0, z: -3 }, direction: { x: 0, z: 1 }, base: 10, multiplier: 1, type, knockback: 0, stagger: 0 })).toBe(0);
  expect(w.entities.get(1)!.health.current).toBe(hp);
  w.hazards!.hit(id, 1000, 'bullet');
  expect(w.combat!.damage.apply({ sourceId: runner.id, targetId: 1, attackId: 101, actionId: 'cover.probe', origin: { x: 0, z: -3 }, direction: { x: 0, z: 1 }, base: 10, multiplier: 1, type: 'bullet', knockback: 0, stagger: 0 })).toBeGreaterThan(0);
});
test('T-E26-13 @E26 @E26-AC13 parked car braces at 100% coverage and twice car HP; break releases it', async () => {
  const w = await world('horde-arena'), carId = w.vehicles!.spawn('vehicle.sedan', { x: 0, z: 0 }), car = w.vehicles!.cars.get(carId)!;
  const id = w.barricades!.spawn({ id: 'car', groupId: 'cars', a: { x: -1.5, z: 0 }, b: { x: 1.5, z: 0 }, height: 1 });
  step(w, 120); teleport(w, 0, 1.5); step(w, 90); const e = w.entities.get(id)!;
  expect(e.barricade!.coverage).toBe(1); expect(e.barricade!.intact).toBe(true); expect(e.health.max).toBe(car.entity.health.current * 2);
  expect(car.physics.body.isKinematic()).toBe(true); expect(car.entity.vehicle!.braced).toBe(true);
  w.hazards!.hit(id, e.health.max, 'bullet'); expect(car.physics.body.isDynamic()).toBe(true); expect(car.entity.vehicle!.braced).toBe(false);
});

test('T-E26-11b @E26 @E26-AC11 pooled heavies cannot inherit an interrupted runner vault', async () => {
  const w = await world('horde-arena');
  const runner = w.entities.get(w.infected!.spawn('infected.runner', { x: 0, z: 0 }))!;
  runner.infected!.vault = { started: 0, from: { x: 0, z: 0 }, to: { x: 0, z: 2 }, height: .8 };
  w.infected!.release(runner);
  const brute = w.entities.get(w.infected!.spawn('infected.brute', { x: 0, z: 0 }))!;
  expect(brute).toBe(runner); expect(brute.infected!.vault).toBeUndefined();
  expect(w.barricades!.vault(brute)).toBe(false);
});

test('T-E26-15 @E26 @E26-AC15 60s push/kick/explosion tape has identical repeat state hashes', async () => {
  const { propSequence } = await import('../../src/debug/scenarios/propSequence'); const { stateHash } = await import('../../src/sim/world/stateHash');
  const a = await world('prop-yard'), b = await world('prop-yard'); propSequence(a); propSequence(b);
  expect(a.tick).toBe(3600); expect(stateHash(a.getState())).toBe(stateHash(b.getState()));
});

test('T-E26-14 @E26 @E26-AC14 complete bot fills/braces two slots and defense reduces core arrivals >=40%', async () => {
  const { BarricadeBot } = await import('../../src/debug/bot/BarricadeBot');
  const seeds = Number(process.env.E26_AB_SEEDS ?? 1); expect(seeds).toBeLessThanOrEqual(10);
  const results = [];
  for (let seed = 1; seed <= seeds; seed++) {
  const w = await world('barricade-lab', seed), b = new BarricadeBot(w);
  teleport(w, 0, -4); w.props!.place(w.props!.items[0], { p: [0, 0, -2], q: w.props!.items[0].home.q });
  for (let i = 0; i < 2400 && !b.finished; i++) { w.setInput(b.sample()); w.update(); }
  expect(b.finished, JSON.stringify({ player: w.entities.get(1)!.transform, props: w.props!.items.map(p => p.pose), slots: w.entities.values().filter(e => e.barricade).map(e => ({ b: e.barricade, c: e.interactable })), velocity: w.entities.get(1)!.survivor?.velocity })).toBe(true); expect(w.entities.values().filter(e => e.barricade?.intact && !e.barricade.slot.boardUp)).toHaveLength(2);
  const baseline = await world('barricade-lab', seed); teleport(w, 0, 12); teleport(baseline, 0, 12); w.clearInput();
  w.combat!.damage.god = baseline.combat!.damage.god = false;
  for (const sim of [w, baseline]) for (let i = 0; i < 8; i++) sim.infected!.spawn('infected.runner', { x: (i % 3 - 1) * .8, z: -6 - Math.floor(i / 3) }, { state: 'chase' });
  const arrivals = [new Set<number>(), new Set<number>()];
  for (let i = 0; i < 900; i++) for (const [index, sim] of [w, baseline].entries()) { sim.update(); for (const e of sim.infected!.active) if (e.transform.z >= 10) arrivals[index].add(e.id); }
  expect(baseline.entities.get(1)!.health.current).toBeGreaterThan(0);
  expect(w.entities.get(1)!.health.current).toBeGreaterThan(0); expect(arrivals[1].size).toBeGreaterThan(0);
  expect(arrivals[0].size).toBeLessThanOrEqual(arrivals[1].size * .6);
  results.push({ seed, braced: 2, withBarricades: arrivals[0].size, withoutBarricades: arrivals[1].size, hp: w.entities.get(1)!.health.current });
  }
  console.log(JSON.stringify({ barricadeAB: results }));
}, 30000);

test('T-E26-09b @E26 @E26-AC09 overlapping props do not double-count slot coverage', async () => {
  const w = await world(); const p = w.props!.items[0]; w.props!.place(p, { p: [0, 0, 12], q: p.home.q });
  const a = prop(w, 'prop.traffic-cone', 0, 0, 'overlap-a'), b = prop(w, 'prop.traffic-cone', 0, 0, 'overlap-b');
  // A low rail lets cones qualify by height; their union still cannot fill a 2m opening.
  const id = w.barricades!.spawn({ id: 'overlap', groupId: 'test', a: { x: -1, z: 0 }, b: { x: 1, z: 0 }, height: .4 });
  w.barricades!.update(); const coverage = w.entities.get(id)!.barricade!.coverage;
  expect(coverage).toBeCloseTo(a.half[0] * (a.metadata.barricadeValue ?? 1), 5); expect(coverage).toBeLessThan(.8);
  expect(w.entities.get(id)!.interactable!.enabled).toBe(false);
  w.props!.place(b, { p: [10, 0, 10], q: b.home.q }); w.barricades!.update(); expect(w.entities.get(id)!.barricade!.coverage).toBe(coverage);
});


test('T-E26-03b @E26 @E26-AC03 authored 35kg shopping cart moves along push direction at 55% speed', async () => {
  const w = await world('prop-yard'), cart = w.props!.items[0]; expect(cart.assetId).toBe('prop.shopping-cart'); expect(cart.mass).toBe(35);
  teleport(w, cart.home.p[0], cart.home.p[2] - cart.radius - .4);
  const input = { ...w.inputFrame, move: { x: 0, z: 1 } };
  w.setInput(input); const speed = w.props!.pushSpeed(input);
  expect(speed).toBeGreaterThanOrEqual(.5); expect(speed).toBeLessThanOrEqual(.6); step(w, 30);
  expect(cart.pose.p[2]).toBeGreaterThan(cart.home.p[2] + .2);
  expect(Math.hypot(w.player!.locomotion.velocity.x, w.player!.locomotion.velocity.z) / 4.5).toBeGreaterThanOrEqual(.5);
  expect(Math.hypot(w.player!.locomotion.velocity.x, w.player!.locomotion.velocity.z) / 4.5).toBeLessThanOrEqual(.6);
});
