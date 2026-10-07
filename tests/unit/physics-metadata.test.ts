import { expect, test } from 'vitest';
import { physicsMetadata } from '../../tools/assets/physics-metadata';
import { physicsAssets, pushableProps } from '../../src/data/pushableProps';

test('@E26 authored GLB records are reproduced at layout build with masses, collision shapes and break rules', () => {
  expect(physicsMetadata()).toEqual(physicsAssets);
  expect(Object.keys(physicsAssets).length).toBeGreaterThanOrEqual(80);
  expect(pushableProps['prop.shopping-cart'].mass).toBe(24);
  expect(pushableProps['prop.bench'].breakable?.hp).toBe(120);
  expect(pushableProps['prop.dumpster'].class).toBe('heavy');
  expect(pushableProps['prop.vending-machine']).toBeUndefined();
  for (const p of Object.values(pushableProps)) { expect(p.boxes.length).toBeGreaterThan(0); for (const b of p.boxes) expect(b.min.every((v, a) => Number.isFinite(v) && b.max[a] > v)).toBe(true); }
});
