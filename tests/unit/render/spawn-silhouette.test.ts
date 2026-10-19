import { expect, test } from 'vitest';
import { Matrix4 } from 'three';
import { SpawnDirector } from '../../../src/sim/ai/SpawnDirector';
import type { InfectedSystem } from '../../../src/sim/ai/InfectedSystem';
import type { CoverWall } from '../../../src/sim/combat/HitQuery';

test('T-E22-20-silhouette @E22-AC20 spawn silhouettes agree with the original slab and corner queries', () => {
  const walls: CoverWall[] = [
    { x: 0, y: 2, z: 0, halfX: 3, halfY: 2, halfZ: 2 },
    { x: -5, y: 1, z: 4, halfX: 2, halfY: 1, halfZ: 1 },
    { x: 5, y: 3, z: -4, halfX: 1, halfY: 3, halfZ: 3 },
  ];
  const director = new SpawnDirector({ world: { combat: { definition: { walls } } } } as InfectedSystem);
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
