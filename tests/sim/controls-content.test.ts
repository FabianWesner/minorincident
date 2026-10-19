import { afterEach, expect, test } from 'vitest';
import { SimWorld } from '../../src/sim/world/SimWorld';
import { emptyInput } from '../../src/input/InputFrame';
import { Matrix4 } from 'three';

let world: SimWorld;
afterEach(() => world?.dispose());
async function arena() {
  world = new SimWorld(); await world.init(); world.loadScenario('horde-arena', 1);
  for (const e of [...world.infected!.active]) world.infected!.release(e);
  return world;
}
test('@E03 @E19 @E03-AC05 @E19-AC16 bicycle WASD uses local throttle, brakes then reverses, and steers at every heading', async () => {
  const w = await arena(), bike = w.vehicles!.bicycle;
  bike.spawn({ x: 0, z: 0 });
  const b = bike.entity!.bicycle!; b.mounted = true;
  for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    b.heading = heading; b.speed = 0; b.steer = 0;
    const frame = emptyInput(); frame.move = { x: -.7, z: -.7 }; frame.drive = { throttle: 1, steer: 0 };
    const out = bike.filter(frame);
    expect(b.heading).toBeCloseTo(heading, 8);
    expect(out.move.x * Math.cos(heading) + out.move.z * Math.sin(heading)).toBeGreaterThan(0);
    b.speed = 2; w.player!.locomotion.displacement.x = 2 / 60;
    frame.drive = { throttle: -1, steer: 0 }; bike.filter(frame);
    expect(b.speed).toBeGreaterThan(0); expect(b.speed).toBeLessThan(2);
    b.speed = 0; bike.filter(frame); expect(b.speed).toBeLessThan(0);
    b.speed = 2; frame.drive = { throttle: 1, steer: 1 }; bike.filter(frame);
    expect(b.heading).toBeGreaterThan(heading);
    b.heading = heading; b.steer = 0; frame.drive.steer = -1; bike.filter(frame);
    expect(b.heading).toBeLessThan(heading);
  }
});
test('@E05 @E05-AC11 auto-aim picks the nearest on-screen target in ±35 degrees and otherwise keeps straight', async () => {
  const w = await arena(), assist = w.combat!.assist;
  const spawn = (x: number, z: number) => w.infected!.spawn('infected.runner', { x, z });
  spawn(1, 2); // Nearer but outside the cone.
  const near = spawn(4, 1), far = spawn(6, 0);
  const aim = { x: 1, z: 0 }; assist.facing({ x: 0, z: 0 }, aim, 22);
  expect(aim.x).toBeCloseTo(4 / Math.sqrt(17)); expect(aim.z).toBeCloseTo(1 / Math.sqrt(17));
  // Exclude the nearer target using the actual sim-camera viewport rule.
  w.infected!.director.setFrustum(new Matrix4().makeOrthographic(-10, 10, .5, -.5, .1, 100).multiply(new Matrix4().makeTranslation(0, -.35, -10)).elements);
  // Both eligible targets are outside this narrow frame's vertical extent.
  assist.facing({ x: 0, z: 0 }, Object.assign(aim, { x: 1, z: 0 }), 22);
  expect(aim).toEqual({ x: 1, z: 0 });
  w.infected!.release(w.entities.get(near)!); w.infected!.release(w.entities.get(far)!);
  assist.facing({ x: 0, z: 0 }, Object.assign(aim, { x: 1, z: 0 }), 22);
  expect(aim).toEqual({ x: 1, z: 0 });
});
test('@E05 @E05-AC11 walking north aims north immediately even when previously facing south', async () => {
  const w = await arena(), p = w.entities.get(1)!;
  p.transform.yaw = -Math.PI / 2;
  w.infected!.spawn('infected.runner', { x: 0, z: -4 });
  w.infected!.spawn('infected.runner', { x: 0, z: 2 });
  const raw = emptyInput(); raw.move = { x: 0, z: -1 }; raw.aimSource = 'assist';
  const resolved = w.controls.resolve(raw);
  expect(resolved.aim!.z).toBeLessThan(-.99);
});
