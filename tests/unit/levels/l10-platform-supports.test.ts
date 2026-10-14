import { expect, test } from 'vitest';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Placement } from '../../../src/levels/districts/types';

/** L10 finale platform at (-8, -6): placed like the finale anchors (l10Finale.ts props), yaw 0. */
const platform: Placement = {
  id: 'platform', assetId: 'kit.dispersal-platform', position: [-8, 0, -6], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, allowRoad: true, lightGroup: '',
  visualAabb: { min: [-12, 0, -8], max: [0, 4, -4] },
};

function topAt(x: number, z: number): number {
  let top = 0;
  for (const c of placementColliders([platform], [])) if (c.walkable && x >= c.aabb.min[0] && x <= c.aabb.max[0] && z >= c.aabb.min[2] && z <= c.aabb.max[2]) top = Math.max(top, c.aabb.max[1]);
  return top;
}

test('the finale platform deck and its stair are walkable supports, a step at a time from the street to the deck', () => {
  expect(topAt(-8, -6)).toBeCloseTo(3.08, 2); // deck top under the gun
  expect(topAt(-5, -4.5)).toBeCloseTo(3.08, 2); // deck corner near the stair end
  // Walk the stair from the foot (x ~ 0.2) up to the top (x = -4) along z = -6: no step above the 0.4 m autostep.
  let previous = 0, maxStep = 0;
  for (let x = 0.15; x >= -4.2; x -= .05) { const top = topAt(x, -6); maxStep = Math.max(maxStep, top - previous); previous = top; }
  expect(previous).toBeCloseTo(3.08, 2);
  expect(maxStep).toBeLessThanOrEqual(.4);
  // The stair is as wide as drawn (1.3 m) and not wider.
  expect(topAt(-2, -6 + .6)).toBeGreaterThan(1); expect(topAt(-2, -6 + .9)).toBe(0);
});

test('the four columns and the deck rails block, the deck and treads do not', () => {
  const solid = placementColliders([platform], []).filter(c => !c.walkable);
  expect(solid.length).toBeGreaterThanOrEqual(4);
  const walkable = placementColliders([platform], []).filter(c => c.walkable);
  expect(walkable.length).toBe(16);
});
