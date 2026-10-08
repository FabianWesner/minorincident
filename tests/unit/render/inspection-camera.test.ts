import { describe, expect, it } from 'vitest';
import { View } from '../../../src/render/View';

/** Spawn director must retain the courier camera even after arbitrary inspection renders. */
describe('inspection camera', () => {
  it('preserves every normal tick pose and the director frustum', () => {
    const normal = new View(), inspected = new View();
    for (const view of [normal, inspected]) view.reset({ x: 4, z: -7 });
    inspected.inspectionPose = { position: [120, 70, 90], target: [-50, 0, -20] };
    for (let tick = 0; tick < 3600; tick++) {
      const courier = { x: Math.sin(tick / 100) * 20, z: tick / 60 };
      normal.update(courier, 1 / 60); inspected.update(courier, 1 / 60);
      normal.present(1); inspected.present(1, true);
      expect(inspected.camera.position.toArray()).toEqual(normal.camera.position.toArray());
      expect(inspected.camera.matrixWorldInverse.elements).toEqual(normal.camera.matrixWorldInverse.elements);
      inspected.present(.4); expect(inspected.camera.position.toArray()).toEqual([120, 70, 90]);
    }
    inspected.inspectionPose = null; inspected.present(1);
    expect(inspected.camera.position.toArray()).toEqual(normal.camera.position.toArray());
    expect(inspected.cameraTarget.toArray()).toEqual(normal.cameraTarget.toArray());
  });
  it('freezes LOD at game distance while preserving the visible frustum', () => {
    const view = new View(); view.reset({ x: 0, z: 0 });
    view.inspectionPose = { position: [2, 1.5, 2], target: [0, 0, 0] }; view.present(1);
    expect(view.lodCamera).toBe(view.camera);
    view.inspectionGameLod = true;
    const camera = view.lodCamera;
    expect(camera.position.distanceTo(view.cameraTarget)).toBeCloseTo(19);
    expect(view.camera.position.toArray()).toEqual([2, 1.5, 2]);
    expect(camera.fov).toBe(view.camera.fov);
  });
});
