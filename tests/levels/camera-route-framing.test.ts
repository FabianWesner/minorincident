import { expect, test } from 'vitest';
import { Box3, Vector3 } from 'three';
import { View } from '../../src/render/View';
import { cameraFraming } from '../../src/data/cameraFraming';
import { loadLevel, runnerLevels } from '../../tools/sim-runner/levels';
import { l4 } from '../../src/data/l4';
import { crossing } from '../../src/levels/L9/district';
import { cure } from '../../src/levels/L10/district';

for (const level of runnerLevels) test(`${level} authored waypoint sweep preserves player framing @camera-hotfix @E02${level === 'L4' ? ' @E22' : ''}`, async () => {
  const world = await loadLevel(level, 1);
  try {
    const solids = world.districts!.districts.filter(d => d.id === 'D-FAIR').flatMap(d => d.decay.placements.filter(p => p.assetId.startsWith('bld.')).map(p => {
      const { min, max } = p.visualAabb, [x, z] = d.origin;
      return new Box3(new Vector3(min[0] + x, min[1], min[2] + z), new Vector3(max[0] + x, max[1], max[2] + z));
    }));
    const waypoints = Object.values(world.missions!.def.anchors).map(a => ({ x: a.x, z: a.z, y: (a.y ?? world.districts!.pavingHeight(a.x, a.z)) + .72 }));
    if (level === 'L4') waypoints.push(...l4.finale.route.map(([x, z]) => ({ x, z, y: .85 })), { x: -56.23, z: 32.11, y: .85 });
    if (level === 'L9') waypoints.push(...crossing.routes.flatMap(r => [...r.points, ...r.detour]).map(([x, z]) => ({ x, z, y: .72 })));
    if (level === 'L10') waypoints.push(...[...cure.regions, ...cure.detours].flatMap(r => r.route).map(([x, z]) => ({ x, z, y: .72 })));
    // Sweep every authored street polyline as well as mission destinations,
    // including alternative branches that a completion bot might never choose.
    const streets = world.districts!.districts.flatMap(d => d.layout.roads.edges.map(edge => edge.points.map(([localX, localZ]) => {
      const x = localX + d.origin[0], z = localZ + d.origin[1];
      return { x, z, y: world.districts!.pavingHeight(x, z) + .72 };
    })));
    const routes = [waypoints, ...streets].filter(route => route.length > 1);
    expect(waypoints.length).toBeGreaterThan(1);
    for (const zoom of [.5, 1, 1.5]) {
      const requestedRadius = cameraFraming.radiusM * zoom;
      const view = new View(); view.cameraShake = false;
      // Install main's facade inputs as well: this regression must expose the old clearLens contraction.
      Object.assign(view, { cameraSolids: solids });
      if (level === 'L4') {
        const reported = { x: -56.23, z: 32.11, y: .85 };
        view.reset(reported); view.zoom(Math.log(zoom), true);
        for (let tick = 0; tick < 120; tick++) view.update(reported, 1 / 60);
        const offset = view.camera.position.clone().sub(view.cameraTarget);
        expect(Math.abs(Math.acos(offset.y / offset.length()) - cameraFraming.polar), 'PO refuge-door-7 spot').toBeLessThanOrEqual(8 * Math.PI / 180);
        expect(offset.length()).toBeGreaterThanOrEqual(requestedRadius * .85 - 1e-8);
      }
      let samples = 0;
      for (const route of routes) {
        view.reset(route[0]); view.zoom(Math.log(zoom), true);
        for (const destination of route) {
          const start = view.focus.clone(), distance = Math.hypot(destination.x - start.x, destination.z - start.z);
          const ticks = Math.max(1, Math.ceil(distance / .25));
          for (let tick = 1; tick <= ticks; tick++) {
            const t = tick / ticks;
            view.update({ x: start.x + (destination.x - start.x) * t, z: start.z + (destination.z - start.z) * t, y: start.y + .72 + (destination.y - start.y - .72) * t }, 1 / 60);
            const offset = view.camera.position.clone().sub(view.cameraTarget);
            const polar = Math.acos(offset.y / offset.length());
            expect(Math.abs(polar - cameraFraming.polar), `${level} zoom ${zoom} at ${view.focus.toArray()}`).toBeLessThanOrEqual(8 * Math.PI / 180);
            expect(offset.length()).toBeGreaterThanOrEqual(requestedRadius * .85 - 1e-8);
            samples++;
          }
        }
      }
      expect(samples).toBeGreaterThan(1);
    }
  } finally { world.dispose(); }
}, 180_000);
