import { expect, test } from 'vitest';
import { NavGrid } from '../../../src/sim/ai/NavGrid';

test('@E24-AC17 player floor routes retain live gates and rebakes without changing crowd navigation', () => {
  const nav = new NavGrid({ width: 20, depth: 20 }, [], .5);
  nav.setPlayerMask((x, z) => z >= 1);
  const player = nav.forPlayer(.45);
  expect(nav.clear(0, 0, .45)).toBe(true);
  expect(player.clear(0, 0, .45)).toBe(false);
  expect(player.visible({ x: -2, z: 2 }, { x: 2, z: 0 }, .45)).toBe(false);
  const gate = { x: 0, z: 4, y: 1, halfX: .1, halfZ: 2, halfY: 1 };
  nav.setBlocker(42, gate, true);
  expect(player.clear(0, 4, .45)).toBe(false);
  nav.setBlocker(42, gate, false);
  expect(player.clear(0, 4, .45)).toBe(true);
  nav.rebake();
  expect(nav.forPlayer(.45).clear(0, 0, .45)).toBe(false);
  const route = { path: [] as number[], goal: -1, pathIndex: 0 }, waypoint = { x: 0, z: 0 };
  expect(nav.steer({ x: 0, z: 4 }, { x: 0, z: -4 }, route, .45, waypoint, Infinity, true)).toBe(true);
  expect(waypoint.z).toBeGreaterThanOrEqual(1);
});
