import { afterEach, expect, test } from 'vitest';
import { loadL6 } from '../../tools/sim-runner/l6Bots';
import { emptyInput } from '../../src/input/InputFrame';
import type { SimWorld } from '../../src/sim/world/SimWorld';
let world: SimWorld | undefined;
afterEach(() => world?.dispose());
test('T-E24-17-route @E24-AC17 @E24-AC10 escort navigation stays in the authored tunnel around the first gate', async () => {
  ({ world } = await loadL6());
  const nav = world.infected!.nav.forPlayer(.45);
  // Crowd perception retains its original domain; only player routes need
  // the physical floor boundary (the shared mask broke retreat balance).
  expect(world.infected!.nav.contains(88, 10.8)).toBe(true);
  // This unmodelled strip was accepted as a shortcut beside the tunnel. The
  // physical courier then hit the south face of the service-gate barrier.
  expect(nav.clear(88, 10.8, .45)).toBe(false);
  expect(nav.visible({ x: 86, z: 15 }, { x: 94, z: 10.8 }, .45)).toBe(false);
  const route = { path: [] as number[], goal: -1, pathIndex: 0 };
  const p = { x: 84, z: 15 }, waypoint = { x: 0, z: 0 };
  for (let i = 0; i < 600 && p.x < 95; i++) {
    expect(nav.steer(p, { x: 96, z: 15 }, route, .45, waypoint, Infinity, true)).toBe(true);
    const dx = waypoint.x - p.x, dz = waypoint.z - p.z, d = Math.hypot(dx, dz);
    if (d) nav.move(p, dx / d * .05, dz / d * .05, .45);
    expect(p.z).toBeGreaterThan(11.2);
    expect(p.z).toBeLessThan(18.8);
  }
  expect(p.x).toBeGreaterThanOrEqual(95);
});

test('T-E24-17-room-boundary @E24-AC17 raw movement cannot leave the authored tunnel floor', async () => {
  ({ world } = await loadL6());
  const player = world.entities.get(1)!;
  Object.assign(player.transform, { x: 25, y: 1.32, z: 0 });
  world.physics.playerBody!.setTranslation(player.transform, true);
  const frame = emptyInput();
  frame.move = { x: 1, z: 0 };
  for (let i = 0; i < 120; i++) {
    world.applyInput(frame, 'keyboard'); world.update();
    expect(world.player!.locomotion.movementMask!(player.transform.x, player.transform.z)).toBe(true);
    expect(player.transform.x).toBeLessThan(30);
  }
  frame.move = { x: 0, z: 1 };
  for (let i = 0; i < 60; i++) { world.applyInput(frame, 'keyboard'); world.update(); }
  expect(player.transform.z).toBeGreaterThan(4);
});
