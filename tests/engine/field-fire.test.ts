import { expect, test } from 'vitest';
import { FieldFire } from '../../src/sim/interact/FieldFire';
import type { Placement } from '../../src/levels/districts/types';

const crop = (id: string, x: number, assetId = 'veg.corn-block') => ({ id, assetId, position: [x, 0, 0], yaw: 0, scale: [1, 1, 1], minTier: 0, maxTier: 6, decor: true, allowRoad: false, lightGroup: 'decor', visualAabb: { min: [x - 1, 0, -1], max: [x + 1, 2, 1] } }) as Placement;

test('field fire spreads deterministically between crops and leaves persistent scorched cells', () => {
  const placements = [crop('a', 0), crop('b', 10), crop('c', 20), crop('road', 0, 'road.asphalt')];
  const first = new FieldFire(placements), second = new FieldFire(placements);
  expect(first.ignite({ x: 0, z: 0 }, 10, .1)).toBe(1);
  expect(second.ignite({ x: 0, z: 0 }, 10, .1)).toBe(1);
  for (let tick = 10; tick <= 600; tick++) { first.update(tick); second.update(tick); }
  expect(first.snapshot()).toEqual(second.snapshot());
  expect(first.cells.map(c => c.state)).toEqual(['scorched', 'scorched', 'scorched']);
  const saved = first.snapshot(), restored = new FieldFire(placements);
  restored.restore(saved);
  restored.update(1000);
  expect(restored.cells.map(c => c.state)).toEqual(['scorched', 'scorched', 'scorched']);
});


test('a barrier prevents both direct ignition and spread across it', () => {
  const field = new FieldFire([crop('a', 0), crop('b', 10)], (a, b) => (a.x < 5 && b.x > 5) || (a.x > 5 && b.x < 5));
  expect(field.ignite({ x: 0, z: 0 }, 1, 15)).toBe(1);
  for (let tick = 1; tick < 600; tick++) field.update(tick);
  expect(field.cells.map(cell => cell.state)).toEqual(['scorched', 'intact']);
});
