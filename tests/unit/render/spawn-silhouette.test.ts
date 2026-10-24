import { expect, test } from 'vitest';
import { Matrix4, PerspectiveCamera, Vector3 } from 'three';
import { l4, l4OffscreenMouths } from '../../../src/data/l4';
import { cameraFraming } from '../../../src/data/cameraFraming';
import { SpawnDirector } from '../../../src/sim/ai/SpawnDirector';
import type { InfectedSystem } from '../../../src/sim/ai/InfectedSystem';

test('T-E22-20-silhouette @E22-AC20 spawn silhouettes agree with the original slab and corner queries', () => {
  const walls = [
    { x: 0, y: 2, z: 0, halfX: 3, halfY: 2, halfZ: 2 },
    { x: -5, y: 1, z: 4, halfX: 2, halfY: 1, halfZ: 1 },
    { x: 5, y: 3, z: -4, halfX: 1, halfY: 3, halfZ: 3 },
  ];
  const buildings = walls.map((wall, i) => ({ id: `building-${i}`, assetId: 'building.test', label: 'test', aabb: {
    min: [wall.x - wall.halfX, wall.y - wall.halfY, wall.z - wall.halfZ] as [number, number, number],
    max: [wall.x + wall.halfX, wall.y + wall.halfY, wall.z + wall.halfZ] as [number, number, number],
  } }));
  // Generic solids and vehicle colliders are intentionally absent: only a
  // solid building can make a visible spawn safe through occlusion.
  const director = new SpawnDirector({ world: { combat: { definition: { walls } }, districts: { districts: [{ origin: [0, 0], layout: { buildings } }] } } } as unknown as InfectedSystem);
  const genericOnly = new SpawnDirector({ world: { combat: { definition: { walls } }, districts: { districts: [] } } } as unknown as InfectedSystem);
  const projection = new Matrix4().makeScale(.04, .1, .04).elements;
  director.setFrustum(projection, { x: -10, y: 2, z: 0 }); genericOnly.setFrustum(projection, { x: -10, y: 2, z: 0 });
  expect(director.occluded({ x: 5, z: 0 })).toBe(true);
  expect(genericOnly.occluded({ x: 5, z: 0 }), 'generic collision walls cannot authorize a spawn').toBe(false);
  for (const origin of [{ x: 0, y: 8, z: 12 }, { x: 0, y: 2, z: 0 }, { x: -8, y: 1, z: 0 }]) {
    director.setFrustum(new Matrix4().makeScale(.04, .1, .04).elements, origin);
    for (let x = -12; x <= 12; x += .75) for (let z = -12; z <= 12; z += .75) {
      const p = { x, z };
      const expected = [-.5, .5].every(dx => [-.5, .5].every(dz => [.1, 1.9].every(y => walls.some(wall => {
        if (wall.halfY * 2 < 2.2) return false;
        let near = 0, far = 1;
        for (const [axis, half] of [['x', wall.halfX], ['y', wall.halfY], ['z', wall.halfZ]] as const) {
          const end = axis === 'y' ? y : p[axis] + (axis === 'x' ? dx : dz), delta = end - origin[axis];
          if (Math.abs(delta) < 1e-8) { if (origin[axis] < wall[axis] - half || origin[axis] > wall[axis] + half) return false; }
          else { const a = (wall[axis] - half - origin[axis]) / delta, b = (wall[axis] + half - origin[axis]) / delta; near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b)); }
        }
        return near < far && far > 0 && near < .98;
      }))));
      expect(director.occluded(p)).toBe(expected);
      for (const floor of [0, 2]) expect(director.offscreen(p, floor)).toBe([-.5, .5].every(dx => [-.5, .5].every(dz => [.1, 1.9].every(y => !director.visible({ x: x + dx, z: z + dz, y: y + floor })))));
    }
  }
});

test('L4 authored street mouths stay beyond the camera frustum plus 6 m throughout the camp and zoom range', () => {
  const director = new SpawnDirector({ world: { scenario: 'L4', combat: { definition: { walls: [] } } } } as unknown as InfectedSystem);
  const offset = new Vector3();
  for (const aspect of [16 / 9, 390 / 844, 844 / 390]) {
    const camera = new PerspectiveCamera(cameraFraming.fovDeg, aspect, .1, 600);
    const radius = aspect >= 1 ? cameraFraming.radiusM : Math.max(cameraFraming.radiusM, cameraFraming.portraitWidthM / (2 * Math.tan(cameraFraming.fovDeg * Math.PI / 360) * aspect));
    const xs = Array.from({ length: Math.ceil(l4.perimeter.x1 - l4.perimeter.x0) + 1 }, (_, i) => Math.min(l4.perimeter.x1, l4.perimeter.x0 + i));
    const zs = Array.from({ length: Math.ceil(l4.perimeter.z1 - l4.perimeter.z0) + 1 }, (_, i) => Math.min(l4.perimeter.z1, l4.perimeter.z0 + i));
    for (const x of xs) for (const z of zs) {
      for (const zoom of [.5, .75, 1, 1.25, 1.5]) {
        offset.setFromSphericalCoords(radius * zoom, cameraFraming.polar, Math.PI / 4);
        camera.position.set(x + offset.x, offset.y, z + offset.z); camera.lookAt(x, 0, z); camera.updateMatrixWorld(true);
        director.setFrustum(camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements, camera.position);
        for (const mouth of l4OffscreenMouths) expect(director.offscreen({ x: mouth.at[0], z: mouth.at[1] }), `${mouth.id} at courier ${x},${z}, zoom ${zoom}, aspect ${aspect}`).toBe(true);
      }
    }
  }
});
