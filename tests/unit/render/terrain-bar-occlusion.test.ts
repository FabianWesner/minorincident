import { describe, expect, test } from 'vitest';
import { Box3, PerspectiveCamera, Raycaster, Vector3 } from 'three/webgpu';
import { DistrictView } from '../../../src/render/DistrictView';

describe('@E29 health bars respect the terrain occlusion rule', () => {
  const camera = new PerspectiveCamera(); camera.position.set(10, 8, 10);
  const makeView = () => Object.assign(Object.create(DistrictView.prototype), {
    barRay: new Raycaster(), barBox: new Box3(), barHit: new Vector3(), lodBatches: [], stepEdges: {}, maxBarTerrainHeight: 3.9,
    world: { pavingHeight: (x: number, z: number) => x > 2 && x < 8 && z > 2 && z < 8 ? 3.9 : 0 },
  }) as DistrictView;
  test('hides a figure below a foreground terrace even with no solid prop batches', () => {
    expect(makeView().occludesBar(camera, new Vector3(0, .9, 0))).toBe(true);
  });
  test('does not treat an overhanging deck as filled terrain in other districts', () => {
    const district = Object.assign(makeView(), { maxBarTerrainHeight: 0 }) as unknown as DistrictView;
    const belowDeck = new PerspectiveCamera(); belowDeck.position.set(10, 2, 10);
    expect(district.occludesBar(belowDeck, new Vector3(0, .9, 0))).toBe(false);
  });
  test('keeps figures on the upper terrace and on unobstructed lower ground', () => {
    expect(makeView().occludesBar(camera, new Vector3(5, 4.8, 5))).toBe(false);
    expect(makeView().occludesBar(camera, new Vector3(0, .9, 10))).toBe(false);
  });
});
