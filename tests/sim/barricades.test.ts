import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { MAX_AWAKE_PROPS } from '../../src/sim/interact/PropSystem';
import { infectedDef } from '../../src/data/infected';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world(name = 'barricade-lab') { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(name); w.combat!.damage.god = true; return w; }
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
test('T-E26-07 @E26-AC07 fallen props reset to spawn asleep within one tick', async () => {
  const w = await world('prop-yard'), p = w.props!.items[0]; p.body.setTranslation({ x: 10, y: -6, z: 3 }, true); w.props!.postPhysics();
  expect(p.pose).toEqual(p.home); expect(p.body.isSleeping()).toBe(true);
});
test('T-E26-09 @E26-AC09 coverage rejects overlaps and low fill; 1.5s brace pins props and blocks navigation', async () => {
  const w = await world(), e = slot(w), p = w.props!.items[0];
  w.props!.place(p, { p: [0, 0, 12], q: p.home.q }); step(w, 1); expect(e.barricade!.coverage).toBe(0); expect(e.interactable!.enabled).toBe(false);
  w.props!.place(p, p.home); teleport(w, 0, 1.3); step(w, 1); expect(e.barricade!.coverage).toBeGreaterThanOrEqual(.8);
  step(w, 88); expect(w.barricades!.barricadeIntact('door')).toBe(false); step(w, 1);
  expect(w.barricades!.barricadeIntact('door')).toBe(true); expect(e.health.max).toBe(p.metadata.barricadeHP); expect(p.body.isKinematic()).toBe(true);
  expect(w.infected!.nav.clear(0, 0, .2)).toBe(false); expect(w.barricades!.allBarricaded('defense')).toBe(false);
});
test('T-E26-10 @E26-AC10 10 runners deal authored volleys; Brute is fivefold; break releases props and nav synchronously', async () => {
  const w = await world(); teleport(w, 0, 1.3); step(w, 90); teleport(w, 0, 8);
  const e = slot(w); e.health = { current: 400, max: 400 };
  for (let i = 0; i < 10; i++) w.infected!.spawn('infected.runner', { x: (i % 5 - 2) * .35, z: -1 - Math.floor(i / 5) * .2 }, { state: 'chase' });
  step(w, Math.ceil(infectedDef('infected.runner').windup * 60) + 1);
  expect(e.health.current).toBeCloseTo(400 - 10 * infectedDef('infected.runner').damage, 5);
  const period = 60 + Math.ceil(infectedDef('infected.runner').windup * 60) + 1;
  step(w, period * 2);
  expect(e.health.current).toBeCloseTo(400 - 30 * infectedDef('infected.runner').damage, 5);
  step(w, period);
  const brute = w.infected!.spawn('infected.brute', { x: 0, z: -1 }, { state: 'chase' }); expect(w.infected!.barricadeDamage(brute, 10)).toBe(50);
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
