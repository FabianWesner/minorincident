import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { finale } from '../../../src/data/l10Finale';
import { cure } from '../../../src/levels/L10/district';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout, Point } from '../../../src/levels/districts/types';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;

test('T-E32-17-D4 @E32-AC03 @E32-AC17 R7 route, installation and three dodge lanes connect to the console', () => {
  const w = new DistrictWorld(compositions.L10, [layout], 32);
  const [ox, oz] = cure.anchors['dispersal-origin'];
  const worldPoint = ([x, z]: Point): Point => [ox + x, oz + z];
  const reached = w.nav.flood(cure.anchors['cure-complex']);
  const routes = [cure.regions[6].route, ...finale.lanes.map(l => l.points.map(worldPoint))];
  for (const route of routes) for (let i = 1; i < route.length; i++) {
    const a = route[i - 1], b = route[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= d; t += .5) {
      const p: Point = [a[0] + (b[0] - a[0]) * t / d, a[1] + (b[1] - a[1]) * t / d];
      expect(w.nav.walkable(p), JSON.stringify(p)).toBe(true);
      expect(reached[w.nav.index(...p)]).toBe(1);
    }
  }
  for (const lane of finale.lanes) for (let i = 1; i < lane.points.length; i++) {
    const a = lane.points[i - 1], b = lane.points[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let t = 0; t <= d; t += .5) for (const side of [-1, 1]) {
      const p = worldPoint([a[0] + (b[0] - a[0]) * t / d - (b[1] - a[1]) / d * lane.halfWidth * side,
        a[1] + (b[1] - a[1]) * t / d + (b[0] - a[0]) / d * lane.halfWidth * side]);
      expect(w.nav.walkable(p), `${lane.id} edge ${p}`).toBe(true);
    }
  }
  for (const id of ['cure-console', 'cure-install', 'epilogue-walk', 'epilogue-survivors', 'dispersal-horizon']) {
    expect(reached[w.nav.index(...cure.anchors[id])], id).toBe(1);
  }
  for (const p of finale.props) {
    const placed = layout.placements.find(q => q.assetId === p.asset && q.position[0] === ox + p.at[0] && q.position[2] === oz + p.at[1]);
    expect(placed, p.id).toBeDefined();
    expect(placed!.yaw).toBeCloseTo(p.yaw * Math.PI / 180);
  }
  expect(layout.placements.some(p => p.assetId === 'wpn.minigun-mounted')).toBe(false);
  expect(layout.anchors['epilogue-camera'].position[1]).toBe(50);
});
