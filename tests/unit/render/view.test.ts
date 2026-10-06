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

test('T-E02-camera @E02 follow is frame-rate independent and portrait preserves readable framing and nine metres of ground', () => {
  for (const fps of [30, 60, 144]) {
    const view = new View(); view.reset({ x: 0, z: 0 });
    for (let i = 0; i < fps; i++) { view.update({ x: 20, z: 0 }, 1 / fps); expect(view.focus.x).toBeLessThanOrEqual(20); }
    expect(view.focus.x).toBeCloseTo(20, 2);
  }
  const view = new View();
  const height = (width: number, viewportHeight: number) => {
    view.resize(width, viewportHeight); view.reset({ x: 0, z: 0 });
    return Math.abs(new Vector3(0, 1.8, 0).project(view.camera).y - new Vector3().project(view.camera).y) * viewportHeight / 2;
  };
  expect(height(390, 844) / height(844, 390)).toBeGreaterThan(.9);
  view.resize(390, 844);
  expect(2 * view.radius * Math.tan(view.camera.fov * Math.PI / 360) * view.camera.aspect).toBeGreaterThanOrEqual(9 - 1e-8);
  expect(height(1600, 900) / 900).toBeGreaterThanOrEqual(1 / 5.5);
  expect(height(1600, 900) / 900).toBeLessThanOrEqual(1 / 4);
});

test('T-E02-cinematic @E02 cinematic pose blends to the target and follow restores the combat pose', () => {
  const view = new View(); view.reset({ x: 0, z: 0 }); const combat = view.camera.position.clone();
  view.cinematic({ position: [4, 7, 9], target: [2, 0, 3] });
  expect(view.camera.position.equals(combat)).toBe(true);
  view.update({ x: 0, z: 0 }, 0.5); expect(view.camera.position.distanceTo(new Vector3(4, 7, 9))).toBeGreaterThan(0);
  view.update({ x: 0, z: 0 }, 0.5); expect(view.camera.position.toArray()).toEqual([4, 7, 9]); expect(view.cameraTarget.toArray()).toEqual([2, 0, 3]);
  view.follow(); view.update({ x: 0, z: 0 }, 1); expect(view.camera.position.distanceTo(combat)).toBeLessThan(1e-10); expect(view.cameraTarget.toArray()).toEqual([0, 0, 0]);
});
