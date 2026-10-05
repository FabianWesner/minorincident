import { expect, test } from 'vitest';
import { Vector3 } from 'three';
import { View } from '../../../src/render/View';

test('T-E02-12 @E02 @E02-AC12 shake is bounded and respects the setting immediately', () => {
  const view = new View(); view.reset({ x: 0, z: 0 });
  const base = view.camera.position.clone();
  view.shake(100);
  for (let i = 0; i < 120; i++) {
    view.update({ x: 0, z: 0 }, 1 / 60);
    expect(view.camera.position.distanceTo(base)).toBeLessThanOrEqual(0.4 + 1e-10);
  }
  view.cameraShake = false; view.shake(1); view.update({ x: 0, z: 0 }, 1 / 60);
  expect(view.camera.position.distanceTo(base)).toBe(0);
  view.cameraShake = true; view.shake(1); view.cameraShake = false; view.update({ x: 0, z: 0 }, 0);
  expect(view.camera.position.distanceTo(base)).toBe(0);
  expect(() => view.shake(NaN)).toThrow(RangeError);
});

test('T-E02-camera @E02 follow is frame-rate independent and portrait protects the complete circle', () => {
  for (const fps of [30, 60, 144]) {
    const view = new View(); view.reset({ x: 0, z: 0 });
    for (let i = 0; i < fps; i++) { view.update({ x: 20, z: 0 }, 1 / fps); expect(view.focus.x).toBeLessThanOrEqual(20); }
    expect(view.focus.x).toBeCloseTo(20, 2);
  }
  const view = new View(); view.resize(390, 844); view.reset({ x: 0, z: 0 });
  for (let i = 0; i < 360; i++) {
    const a = i * Math.PI / 180;
    const p = new Vector3(Math.sin(a) * 12, 0, Math.cos(a) * 12).project(view.camera);
    expect(Math.abs(p.x)).toBeLessThan(1); expect(Math.abs(p.y)).toBeLessThan(1);
  }
});
