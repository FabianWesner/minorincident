// Courier locomotion and health: one kinematic controller and one health/respawn model for every level.
import { afterEach, expect, test } from 'vitest';
import * as RAPIER from '@dimforge/rapier3d-compat';
import { survivor } from '../../src/data/survivor';
import { SimWorld } from '../../src/sim/world/SimWorld';

const worlds: SimWorld[] = [];
async function setup(scenario = 'survivor'): Promise<SimWorld> { const w = new SimWorld(); worlds.push(w); await w.init(); w.loadScenario(scenario, 1); return w; }
const step = (w: SimWorld, ticks: number) => { for (let i = 0; i < ticks; i++) w.update(); };
afterEach(() => { for (const w of worlds) w.dispose(); worlds.length = 0; });

test('movement: fast acceleration and stop, capped diagonal speed, 720°/s turning, one-tick aim snap', async () => {
  const w = await setup(); w.setInput({ move: { x: 1, z: 0 } }); step(w, 9);
  expect(w.player!.locomotion.displacement.x * 60).toBeGreaterThanOrEqual(4.5 * 0.95);
  w.setInput({ move: { x: 0, z: 0 } }); step(w, 6);
  expect(Math.hypot(w.player!.locomotion.displacement.x, w.player!.locomotion.displacement.z)).toBeLessThan(1e-6);
  w.setInput({ move: { x: 10, z: 10 } }); step(w, 15);
  expect(Math.hypot(w.player!.locomotion.velocity.x, w.player!.locomotion.velocity.z)).toBeCloseTo(4.5);

  const a = await setup(), p = a.entities.get(1)!;
  a.setInput({ aim: { x: 0, z: 1 }, left: { held: true, down: false, up: false } }); step(a, 1);
  expect(p.transform.yaw).toBeCloseTo(-Math.PI / 2);
  a.clearInput(); p.transform.yaw = 0; a.setInput({ move: { x: -1, z: 0 }, aim: { x: 1, z: 0 } }); step(a, 1);
  expect(Math.abs(p.transform.yaw)).toBeCloseTo(4 * Math.PI / 60);
  step(a, 14); expect(Math.abs(p.transform.yaw)).toBeCloseTo(Math.PI);

  // L7's logical road remains solid throughout Alpha stun, including when
  // the stun blocks held movement. Removing the support still permits a fall.
  const raised = await setup(), courier = raised.entities.get(1)!;
  expect(raised.player!.locomotion.supportWhenDisabled).toBe(false);
  raised.player!.locomotion.supportWhenDisabled = true;
  courier.transform.y = 3.9 + survivor.height / 2 + .005;
  raised.physics.playerBody!.setTranslation(courier.transform, true);
  raised.solids.remember(courier, 'test.raised-stun');
  raised.player!.locomotion.groundHeight = () => 3.9;
  courier.combat = { radius: survivor.radius, armor: 0, shield: false, staggerUntil: raised.tick + 90, attacking: false, damageMultiplier: 1, statuses: [] };
  raised.setInput({ move: { x: 1, z: 0 } });
  for (let tick = 0; tick < 89; tick++) {
    step(raised, 1);
    expect(courier.transform.y).toBeGreaterThanOrEqual(4.6);
    expect(courier.transform.x).toBeCloseTo(0);
  }
  raised.player!.locomotion.groundHeight = () => 0;
  courier.combat.staggerUntil = raised.tick + 90;
  step(raised, 60); expect(courier.transform.y).toBeLessThan(1);
});

test('walls: a 72-direction capsule sweep never penetrates the wall ring; sliding keeps 60 % tangential speed; head-on corners slip', async () => {
  const w = await setup('survivor-ring');
  for (let i = 0; i < 72; i++) {
    const angle = i * Math.PI * 2 / 72;
    w.entities.get(1)!.transform.x = w.entities.get(1)!.transform.z = 0;
    w.physics.playerBody!.setTranslation(w.entities.get(1)!.transform, true); w.physics.update();
    w.player!.locomotion.reset(); w.setInput({ move: { x: Math.cos(angle), z: Math.sin(angle) } });
    for (let tick = 0; tick < 150; tick++) {
      w.update(); const p = w.entities.get(1)!.transform;
      expect(Math.max(Math.abs(p.x), Math.abs(p.z)) + survivor.radius - 5, `direction ${i}, tick ${tick}`).toBeLessThanOrEqual(0.02);
    }
  }
  const s = await setup('survivor-ring');
  s.entities.get(1)!.transform.x = 4.6; s.entities.get(1)!.transform.z = -3;
  s.physics.playerBody!.setTranslation(s.entities.get(1)!.transform, true); s.physics.update();
  s.setInput({ move: { x: 1, z: 1 } }); step(s, 30);
  const start = s.entities.get(1)!.transform.z; step(s, 30);
  expect((s.entities.get(1)!.transform.z - start) / 0.5).toBeGreaterThanOrEqual(0.6 * 4.5 / Math.SQRT2);
  await cornerSlip();
});

test('health: invulnerability window, delayed regeneration, one death event, respawn at the last checkpoint with level state kept', async () => {
  const w = await setup(), player = w.player!;
  expect(player.damage(20, w.tick)).toBe(20);
  for (let tick = 1; tick < 36; tick++) { step(w, 1); expect(player.damage(20, w.tick)).toBe(0); }
  step(w, 1); expect(player.damage(10, w.tick)).toBe(10);
  step(w, 239); expect(player.entity.health.current).toBe(70);
  step(w, 60); expect(player.entity.health.current).toBeCloseTo(72);
  step(w, 2000); expect(player.entity.health.current).toBe(100);

  const d = await setup(), p = d.player!;
  d.mission = { completedObjectives: ['pharmacy'] }; d.progression = { pickups: ['bat', 'medkit'] };
  p.setCheckpoint({ x: -2, y: 0.705, z: 3 }); p.setCheckpoint({ x: 4, y: 0.705, z: -2 });
  const retained = { mission: structuredClone(d.mission), progression: structuredClone(d.progression) };
  p.damage(100, d.tick); p.damage(100, d.tick);
  expect(d.events.events().filter(e => e.type === 'player.died')).toHaveLength(1);
  d.setInput({ move: { x: 1, z: 0 } }); step(d, 119);
  expect(p.entity.health.current).toBe(0);
  d.clearInput(); step(d, 1);
  expect(p.entity.transform.x).toBeCloseTo(4); expect(p.entity.transform.z).toBeCloseTo(-2);
  expect(p.entity.health.current).toBe(100);
  expect({ mission: d.mission, progression: d.progression }).toEqual(retained);
});

// r2-bike: keyboard movement held head-on into a post or a box corner sidesteps round it instead of stopping dead; a long
// wall still stops her, she never overlaps either solid, and open-ground speed is unchanged.
async function cornerSlip(): Promise<void> {
  const run = async (halfZ: number, centreZ: number) => {
    const w = await setup(), world = w.physics.world!;
    world.createCollider(RAPIER.ColliderDesc.cuboid(.15, 1, halfZ).setTranslation(3, 1, centreZ));
    world.step();
    w.setInput({ move: { x: 1, z: 0 } });
    let minGap = Infinity;
    for (let tick = 0; tick < 150; tick++) {
      w.update(); const p = w.entities.get(1)!.transform;
      minGap = Math.min(minGap, Math.hypot(Math.max(0, Math.abs(p.x - 3) - .15), Math.max(0, Math.abs(p.z - centreZ) - halfZ)) - survivor.radius);
      if (tick === 12) expect(w.player!.locomotion.displacement.x * 60, 'open ground keeps full run speed').toBeCloseTo(survivor.speed, 1);
    }
    return { ...w.entities.get(1)!.transform, minGap };
  };
  const post = await run(.15, 0);
  expect(post.x, 'past the post').toBeGreaterThan(5); expect(post.minGap).toBeGreaterThan(-.02);
  // The courier's line runs 1.05 m inside a 2.8 m fence panel (the L1 house-a lot west of the depot apron).
  const corner = await run(1.4, -1.05);
  expect(corner.x, 'round the lot corner').toBeGreaterThan(5); expect(corner.minGap).toBeGreaterThan(-.02);
  const wall = await run(6, 0);
  expect(wall.x, 'a long wall stops her').toBeLessThan(3 - .15 - survivor.radius + .02); expect(Math.abs(wall.z)).toBeLessThan(.05);
}
