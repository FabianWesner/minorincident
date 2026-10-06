import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { staticCollision } from '../../../src/assets/staticCollision';
import manifest from '../../../src/assets/manifest.json';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import type { Placement } from '../../../src/levels/districts/types';

test('@E19 M1-07 baked static collision is current with delivered GLBs and has finite body-height geometry', () => {
  for (const [id, data] of Object.entries(staticCollision)) {
    expect(createHash('sha256').update(readFileSync(data.source)).digest('hex'), `${id}: run npm run assets:collision after changing GLBs`).toBe(data.hash);
    // A low pallet can have no body-height volume; every taller solid must have it.
    expect(data.boxes.length > 0 || (manifest.find(a => a.id === id)?.dimensions.y ?? Infinity) < .45, id).toBe(true);
    for (const box of data.boxes) for (let axis = 0; axis < 3; axis++) {
      expect(Number.isFinite(box.min[axis]) && Number.isFinite(box.max[axis]), id).toBe(true);
      expect(box.max[axis], id).toBeGreaterThan(box.min[axis]);
    }
  }
});

test('@E19 M1-07 moved, scaled and rotated district dressing retains every compound collider', () => {
  const placement: Placement = { id: 'moved-lamp', assetId: 'prop.street-lamp', position: [11, 0, 19], yaw: Math.PI / 2, scale: [2, 1, 2], minTier: 0, maxTier: 5, lightGroup: '', allowRoad: false, visualAabb: { min: [0, 0, 0], max: [0, 0, 0] } };
  const before = placementColliders([{ ...placement, position: [0, 0, 0], yaw: 0, scale: [1, 1, 1] }], []), after = placementColliders([placement], []);
  expect(after).toHaveLength(before.length);
  for (let i = 0; i < before.length; i++) {
    expect(after[i].aabb.min[0]).toBeCloseTo(11 + before[i].aabb.min[2] * 2);
    expect(after[i].aabb.max[2]).toBeCloseTo(19 - before[i].aabb.min[0] * 2);
  }
});

test('@E19 M1-08 low flower strips never retain a blocking district fallback', () => {
  const aabb = { min: [-1, 0, -.4], max: [1, .39, .4] } as Placement['visualAabb'];
  const placement: Placement = { id: 'flowers', assetId: 'prop.flower', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 5, lightGroup: '', allowRoad: false, visualAabb: aabb };
  expect(placementColliders([placement], [{ id: placement.id, aabb, minTier: 0, maxTier: 5 }])).toEqual([]);
});
