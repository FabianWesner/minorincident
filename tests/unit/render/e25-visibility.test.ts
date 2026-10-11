import { expect, test } from 'vitest';
import { visibilityPolygon } from '../../../src/render/lighting/visibility';

test('T-E25-03u @E25 @E25-AC03 static visibility polygon ends at the fence and retains the unobstructed pool', () => {
  const polygon = visibilityPolygon({ x: 0, z: 0 }, 20, [{ min: [-10, 0, 5], max: [10, 2, 5.2] }]);
  expect(polygon).toHaveLength(66);
  expect(polygon[0]).toEqual([0, 0]);
  // Direction +Z hits the near face; -Z stays at full reach.
  expect(polygon[17][0]).toBeCloseTo(0);
  expect(polygon[17][1]).toBeCloseTo(5);
  expect(polygon[49][1]).toBeCloseTo(-20);
  for (const [x, z] of polygon) if (Math.abs(x) <= 9.9 && z > 0) expect(z).toBeLessThanOrEqual(5.000001);
});

test('T-E25-03b @E25 @E25-AC03 ignore the source pole footprint, but clip against other buildings', () => {
  const polygon = visibilityPolygon({ x: 0, z: 0 }, 10, [
    { min: [-.1, 0, -.1], max: [.1, 4, .1] },
    { min: [3, 0, -2], max: [4, 3, 2] },
  ]);
  expect(polygon[1]).toEqual([3, 0]);
  expect(polygon[33][0]).toBeCloseTo(-10);
});
