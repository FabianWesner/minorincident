import { expect, test } from 'vitest';
import { heightSteps } from '../../../src/sim/world/HeightSteps';
import { heightStepVertices } from '../../../src/render/HeightStepEdges';
import { inside } from '../../../src/levels/districts/validate';
import type { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import type { Point } from '../../../src/levels/districts/types';

test('@E29 step audit includes diagonal and unclosed polygon boundaries, but excludes shallow stairs and shared internal edges', () => {
  const raised: Point[] = [[0, 0], [4, 0], [0, 4]];
  const shallow: Point[] = [[6, 0], [8, 0], [8, 2], [6, 2]];
  const adjacent: Point[] = [[0, -2], [4, -2], [4, 0], [0, 0]];
  const world = {
    districts: [{ origin: [0, 0], id: 'D-FAIR', layout: { walkable: { excluded: [] }, bounds: [[-10, -10], [10, -10], [10, 10], [-10, 10]], surfaces: [
      { polygon: raised, height: 1 }, { polygon: adjacent, height: 1 }, { polygon: shallow, height: .3 },
    ] }, decay: { colliders: [] } }],
    pavingHeight: (x: number, z: number) => inside([x, z], raised) || inside([x, z], adjacent) ? 1 : inside([x, z], shallow) ? .3 : 0,
  } as unknown as DistrictWorld;
  const edges = heightSteps(world);
  expect(edges.some(s => s.a[0] !== s.b[0] && s.a[1] !== s.b[1])).toBe(true);
  expect(edges.some(s => s.a[0] === 0 && s.b[0] === 0 && s.a[1] > 0)).toBe(true);
  expect(edges.every(s => s.upper === 1)).toBe(true);
  expect(edges.some(s => s.a[1] === 0 && s.b[1] === 0)).toBe(false);
  const geometry = heightStepVertices(edges);
  expect(geometry.walls.length).toBe(edges.length * 18);
  expect(geometry.caps.length).toBe(edges.length * 18);
  expect(geometry.walls.every(Number.isFinite)).toBe(true);
});
