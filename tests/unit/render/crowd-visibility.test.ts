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
  const near = visibility.pixels(0, 0, -5, 1.8), far = visibility.pixels(0, 0, -30, 1.8);
  expect(near).toBeCloseTo(far * 6); expect(visibility.lod(2, near)).toBe('lod1');
  expect(visibility.lod(2, 89)).toBe('lod1'); expect(visibility.lod(2, 89)).toBe('lod1');
  expect(visibility.lod(2, far)).toBe('lod2'); expect(visibility.lod(2, 103)).toBe('lod2');
  expect(visibility.lod(2, near)).toBe('lod1');
});

test('animation pixels use the rendered camera while inspection geometry retains its virtual close camera', () => {
  const wide = new PerspectiveCamera(50, 1, .1, 1000), close = new PerspectiveCamera(50, 1, .1, 1000);
  wide.position.z = 40; close.position.z = 10;
  wide.updateMatrixWorld(); close.updateMatrixWorld();
  const visibility = new CrowdVisibility(); visibility.begin(wide, 844, close);
  const geometry = visibility.pixels(0, 0, 0, 1.8), animation = visibility.renderPixels(0, 0, 0, 1.8);
  expect(geometry).toBeCloseTo(animation * 4, 12);
  expect(geometry).toBeGreaterThan(104); expect(animation).toBeLessThan(88);
  expect(visibility.lod(1, geometry)).toBe('lod1');
});
