import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { explosionDef } from '../../src/data/explosions';
import { massResponse } from '../../src/sim/combat/Explosions';
import type { MissionDef } from '../../src/sim/missions/types';

const worlds: SimWorld[] = [];
afterEach(() => { for (const w of worlds.splice(0)) w.dispose(); });
async function world() { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario('horde-arena', 27); w.combat!.damage.god = true; return w; }
const step = (w: SimWorld, n: number) => { for (let i = 0; i < n; i++) w.update(); };
function corpse(w: SimWorld, x: number, z = 0) {
  const id = w.infected!.spawn('infected.runner', { x, z }, { state: 'idle' }), e = w.entities.get(id)!;
  e.health.current = 0; Object.assign(e.infected!, { state: 'dead', deadAt: w.tick - 120, recoverAt: -1 });
  w.infected!.settle(e); expect(w.entities.get(id)!.corpse).toBe(true); return id;
}
const mission: MissionDef = {
  id: 'corpse-flight', briefing: 'Corpse flight', anchors: { spawn: { x: 0, z: 0, radius: 2 } }, actors: {}, groups: {}, gates: {}, items: [], states: [], counters: [], checkpoints: ['C'], cinematics: {},
  steps: [{ id: 'wait', type: 'custom', text: 'Wait', anchor: 'spawn', start: { kind: 'start' }, complete: { kind: 'timer', seconds: 1000 }, fail: [] }], finish: ['wait'], onStart: [], onComplete: [],
};

for (const def of ['explosion.pipe-bomb', 'explosion.propane', 'explosion.car', 'explosion.gas-tanks']) test(`T-E27-corpse-${def} @E27-AC02 @E27-AC15 retained body uses the exact outward/upward curve one tick later without damage or new rigid bodies`, async () => {
  const w = await world(), id = corpse(w, 2), e = w.entities.get(id)!, before = { ...e.transform }, d = explosionDef(def);
  const bodies = w.physics.world!.bodies.len(), hp = w.entities.get(1)!.health.current;
  w.explosions!.blast(def, { x: 0, z: 0 }, { fires: false, damage: false });
  expect(e.transform).toEqual(before); expect(e.corpseBlast!.delay).toBe(1);
  const speed = d.impulse * (d.radius - 2) / (d.radius - 1) * massResponse(70), length = Math.hypot(1 / d.upward, 1);
  step(w, 1);
  expect(e.transform.x).toBeCloseTo(before.x + speed / d.upward / length / 60, 9);
  expect(e.transform.y).toBeCloseTo(before.y + speed / length / 60 - 9.81 / 7200, 9);
  expect(e.corpseThrown).toBe(true); expect(e.health.current).toBe(0);
  expect(w.physics.world!.bodies.len()).toBe(bodies); expect(w.entities.get(1)!.health.current).toBe(hp);
  step(w, 300); expect(e.corpseBlast).toBeUndefined(); expect(e.transform.y).toBeCloseTo(.7, 9);
  expect(w.entities.get(id)).toBe(e); expect(w.infected!.active.some(v => v.id === id)).toBe(false);
  const settled = { ...e.transform }; step(w, 60); expect(e.transform).toEqual(settled);
});

test('T-E27-corpse-restore @E27-AC15 pending and midair body motion survives a real mission checkpoint with identical landing and original id', async () => {
  const w = await world(), m = w.loadMission(mission); m.begin();
  const id = corpse(w, 2);
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  m.checkpoint('C'); const before = structuredClone(w.entities.get(id)!.corpseBlast);
  step(w, 1); const first = { ...w.entities.get(id)!.transform };
  m.restore('C'); expect(w.entities.get(id)!.corpseBlast).toEqual(before);
  step(w, 1); expect(w.entities.get(id)!.transform).toEqual(first);
  step(w, 12); m.checkpoint('C'); const airborne = { ...w.entities.get(id)!.transform };
  expect(airborne.y).toBeGreaterThan(.7); step(w, 300); const landed = { ...w.entities.get(id)!.transform };
  m.restore('C'); expect(w.entities.get(id)!.transform).toEqual(airborne);
  step(w, 300); expect(w.entities.get(id)!.transform).toEqual(landed); expect(w.entities.get(id)!.corpse).toBe(true);
});

test('T-E27-corpse-cover @E27-AC15 full cover and the radius boundary protect retained bodies; zero-impulse effects leave them fixed', async () => {
  const w = await world(), covered = corpse(w, 4), edge = corpse(w, 5), quiet = corpse(w, -2);
  w.barricades!.spawn({ id: 'body-cover', groupId: 'g', a: { x: 3, z: -2 }, b: { x: 3, z: 2 }, height: 2, initialHp: 1e6 });
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  expect(w.entities.get(covered)!.corpseBlast).toBeUndefined(); expect(w.entities.get(edge)!.corpseBlast).toBeUndefined();
  delete w.entities.get(quiet)!.corpseBlast;
  w.explosions!.blast('explosion.molotov', { x: -2, z: 0 }, { fires: false, damage: false });
  expect(w.entities.get(quiet)!.corpseBlast).toBeUndefined();
});

test('T-E27-corpse-flight-wall @E27-AC15 a launched body stops before a thin solid wall and settles without losing its identity', async () => {
  const w = await world(), id = corpse(w, 2);
  w.barricades!.spawn({ id: 'landing-wall', groupId: 'g', a: { x: 3, z: -2 }, b: { x: 3, z: 2 }, height: 2, initialHp: 1e6 });
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  const e = w.entities.get(id)!; expect(e.corpseBlast).toBeDefined();
  step(w, 300);
  expect(e.transform.x).toBeGreaterThan(2); expect(e.transform.x).toBeLessThanOrEqual(3 - .38);
  expect(e.transform.y).toBeCloseTo(.7, 9); expect(e.corpseBlast).toBeUndefined(); expect(w.entities.get(id)).toBe(e);
});

test('T-E27-corpse-grab-handoff @E27-AC15 an explicit Alpha throw takes over a blast flight without competing motion owners', async () => {
  const w = await world(); w.inspectionGhost = true;
  const id = corpse(w, 2), source = w.infected!.spawn('infected.alpha', { x: 5.5, z: 0 }, { state: 'idle' });
  w.explosions!.blast('explosion.propane', { x: 0, z: 0 }, { fires: false, damage: false });
  expect(w.infected!.startSpecial(source, 'alpha.grab-throw', { id: 1, x: 0, z: 0 }, { x: 5.5, z: 0, radius: 1, dx: -1, dz: 0 })).toBe(true);
  step(w, 47); expect(w.entities.get(id)!.corpseBlast).toBeDefined();
  expect(Math.hypot(w.entities.get(source)!.transform.x - w.entities.get(id)!.transform.x, w.entities.get(source)!.transform.z - w.entities.get(id)!.transform.z)).toBeLessThan(2);
  step(w, 1);
  const attack = w.entities.get(source)!.infected!.specialAttack!;
  expect(attack.projectile).toMatchObject({ objectId: id, corpse: true }); expect(w.entities.get(id)!.corpseBlast).toBeUndefined();
  step(w, 120); expect(w.entities.get(id)!.corpse).toBe(true); expect(w.entities.get(id)!.health.current).toBe(0);
});
