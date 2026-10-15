import { expect, test, vi } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { DistrictView } from '../../../src/render/DistrictView';
import { seeThrough } from '../../../src/render/SeeThrough';
import type { View } from '../../../src/render/View';

const fixture = () => {
  const district = Object.assign(Object.create(DistrictView.prototype), {
    foliage: { update: vi.fn(), reveal: true }, updateRoofs: vi.fn(),
    holeTarget: new Vector3(), holeCorner: new Vector3(), subjectBox: new Box3(),
  }) as DistrictView;
  const camera = new PerspectiveCamera(35, 16 / 9, .1, 1000);
  camera.position.set(8, 12, 8); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  return { district, view: { camera } as View };
};

test('player reveal is fully open on the first render and after teleport; a near roof never expands it', () => {
  const { district, view } = fixture();
  seeThrough.strength.value = 0; seeThrough.cover.value = 1;
  district.updateFoliage(view, { x: 0, y: .7, z: 0 });
  expect(seeThrough.strength.value).toBe(1); expect(seeThrough.cover.value).toBe(0);
  const center = seeThrough.center.value.clone();
  district.updateFoliage(view, { x: 4, y: .7, z: -2 });
  expect(seeThrough.strength.value).toBe(1); expect(seeThrough.center.value.distanceTo(center)).toBeGreaterThan(.01);
  district.seeThroughOff = true; district.updateFoliage(view, { x: 4, y: .7, z: -2 });
  expect(seeThrough.strength.value).toBe(0);
});

test('the clear inner disc and depth include every corner of a whole ridden vehicle at all player zooms', () => {
  const { district, view } = fixture(), box = new Box3(new Vector3(-1, 0, -3), new Vector3(1, 2.2, 3));
  for (const zoom of [.5, 1, 1.5]) {
    view.camera.position.set(8 * zoom, 12 * zoom, 8 * zoom); view.camera.lookAt(0, 0, 0); view.camera.updateMatrixWorld();
    district.updateFoliage(view, { x: 0, y: .7, z: 0 }, undefined, box);
    for (const x of [-1, 1]) for (const y of [0, 2.2]) for (const z of [-3, 3]) {
      const point = new Vector3(x, y, z), projected = point.clone().project(view.camera);
      const dx = (projected.x * .5 + .5 - seeThrough.center.value.x) * view.camera.aspect;
      const dy = .5 - projected.y * .5 - seeThrough.center.value.y;
      expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(seeThrough.solidRadius.value * .85 + 1e-8);
      expect(point.applyMatrix4(view.camera.matrixWorldInverse).z).toBeGreaterThan(seeThrough.depth.value);
    }
  }
});
