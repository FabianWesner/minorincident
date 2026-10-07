import { expect, test } from 'vitest';
import { PerspectiveCamera } from 'three';
import { CrowdVisibility } from '../../../src/render/CrowdVisibility';

test('@E18-AC01 animated figure bounds intersecting the screen edge remain visible', () => {
  const camera = new PerspectiveCamera(60, 1, .1, 100); camera.updateMatrixWorld();
  const visibility = new CrowdVisibility(); visibility.begin(camera, 900);
  expect(visibility.visible(0, 0, -10, 1.8)).toBe(true);
  expect(visibility.visible(6, 0, -10, 1.8)).toBe(true);
  expect(visibility.visible(9, 0, -10, 1.8)).toBe(false);
  expect(visibility.visible(0, 0, 10, 1.8)).toBe(false);
});

test('@E18-AC01 zoom selects detail with hysteresis, consistently across batches in one frame', () => {
  const camera = new PerspectiveCamera(60, 1, .1, 100); camera.updateMatrixWorld();
  const visibility = new CrowdVisibility(); visibility.begin(camera, 900);
  const near = visibility.pixels(0, 0, -10, 1.8), far = visibility.pixels(0, 0, -30, 1.8);
  expect(near).toBeCloseTo(far * 3); expect(visibility.lod(2, near, false)).toBe('lod1');
  expect(visibility.lod(2, 75, false)).toBe('lod1'); expect(visibility.lod(2, 75, false)).toBe('lod1');
  expect(visibility.lod(2, far, false)).toBe('lod2'); expect(visibility.lod(2, 84, false)).toBe('lod2');
  expect(visibility.lod(2, near, false)).toBe('lod1'); expect(visibility.lod(2, near, true)).toBe('lod2');
});
