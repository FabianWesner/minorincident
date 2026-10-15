import { expect, test } from 'vitest';
import { Object3D, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { DistrictView } from '../../../src/render/DistrictView';

type Entry = { origin: [number, number]; foot: { cx: number; cz: number; hx: number; hz: number } };
const frame = (DistrictView as unknown as { footFrame(entry: Entry, ref: Object3D): number[] }).footFrame.bind(DistrictView);

test('@E18 camera occluder frames reuse static geometry and follow moved, rotated and scaled placements', () => {
  const entry: Entry = { origin: [100, 50], foot: { cx: 2, cz: -1, hx: 4, hz: 2 } };
  const ref = new Object3D();
  ref.position.set(3, 0, 5);
  const initial = frame(entry, ref);
  expect(initial).toEqual([1, 0, 105, 54]);
  expect(frame(entry, ref)).toBe(initial);
  ref.position.x = 7;
  expect(frame(entry, ref)).toEqual([1, 0, 109, 54]);
  ref.rotation.y = Math.PI / 2;
  ref.scale.set(2, 1, 3);
  const rotated = frame(entry, ref);
  expect(rotated[0]).toBeCloseTo(0);
  expect(rotated[1]).toBeCloseTo(1);
  expect(rotated[2]).toBeCloseTo(104);
  expect(rotated[3]).toBeCloseTo(51);
  expect(frame(entry, ref)).toBe(rotated);
  const other = { ...entry, origin: [200, 60] as [number, number] };
  expect(frame(other, ref)[2]).toBeCloseTo(204);
});

test('@E18 sampled lens and courier rays match the original transformed footprint checks', () => {
  const refs = Array.from({ length: 12 }, (_, i) => {
    const ref = new Object3D(); ref.position.set((i % 4) * 5 - 8, 0, Math.floor(i / 4) * 6 - 6);
    ref.rotation.y = i * .37; ref.scale.set(.7 + i * .03, .8 + i * .04, 1.1 - i * .02); return ref;
  });
  const entry = { id: 'bld.house-a', origin: [0, 0] as [number, number], foot: { cx: .4, cz: -.3, hx: 2, hz: 3 }, height: 6, half: 4, refs };
  const context = Object.assign(Object.create(DistrictView.prototype), { lodBatches: [entry], lensRay: new Vector3(), lensPoint: new Vector3(), occluderId: '', cutPlacements: new Set<Object3D>(), subjectPoints: Array.from({ length: 9 }, () => new Vector3()) });
  const methods = DistrictView.prototype as unknown as {
    huggedOccluder(view: import('../../../src/render/View').View): boolean;
    occluded(view: import('../../../src/render/View').View, player: { x: number; y: number; z: number }): boolean;
  };
  const camera = new PerspectiveCamera(35, 16 / 9);
  const view = { camera } as import('../../../src/render/View').View;
  const originalFrame = (ref: Object3D) => {
    const c = Math.cos(2 * Math.atan2(ref.quaternion.y, ref.quaternion.w)), s = Math.sin(2 * Math.atan2(ref.quaternion.y, ref.quaternion.w));
    return [c, s, ref.position.x + .4 * ref.scale.x * c - .3 * ref.scale.z * s, ref.position.z - .4 * ref.scale.x * s - .3 * ref.scale.z * c];
  };
  let lensHits = 0, courierHits = 0;
  for (let i = 0; i < 100; i++) {
    const player = { x: Math.sin(i * .61) * 12, y: .7, z: Math.cos(i * .43) * 10 };
    camera.position.set(player.x + 4, 2 + i % 8, player.z + 5); camera.lookAt(player.x, player.y, player.z); camera.updateMatrixWorld();
    const o = camera.position, dx = player.x - o.x, dy = player.y + .2 - o.y, dz = player.z - o.z;
    const courier = refs.some(ref => {
      const [c, sn, x, z] = originalFrame(ref); if (Math.abs(x - player.x) > 24 || Math.abs(z - player.z) > 24) return false;
      const ox = o.x - x, oz = o.z - z, sx = ref.scale.x, sz = ref.scale.z;
      let enter = 0, exit = 1;
      for (const [origin, delta, min, max] of [[(ox * c - oz * sn) / sx, (dx * c - dz * sn) / sx, -2, 2], [o.y, dy, 0, 6 * ref.scale.y], [(ox * sn + oz * c) / sz, (dx * sn + dz * c) / sz, -3, 3]]) {
        if (Math.abs(delta) < 1e-6) { if (origin < min || origin > max) { exit = -1; break; } continue; }
        const a = (min - origin) / delta, b = (max - origin) / delta;
        enter = Math.max(enter, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b)); if (enter > exit) break;
      }
      return enter <= exit && enter < .98;
    });
    let blocked = 0;
    const near = refs.filter(ref => Math.abs(ref.position.x - o.x) < 4 * Math.max(ref.scale.x, ref.scale.z) + 8 && Math.abs(ref.position.z - o.z) < 4 * Math.max(ref.scale.x, ref.scale.z) + 8);
    for (const [x, y] of [[0, 0], [-.5, -.5], [.5, -.5], [-.5, .5], [.5, .5]]) {
      const ray = new Vector3(x, y, .5).unproject(camera).sub(o).normalize();
      for (let d = 1; d <= 8; d++) {
        const p = o.clone().addScaledVector(ray, d);
        if (near.some(ref => {
          const [c, s, cx, cz] = originalFrame(ref), dx = p.x - cx, dz = p.z - cz;
          return p.y > .3 && p.y < 6 * ref.scale.y && Math.abs((dx * c - dz * s) / ref.scale.x) < 2 && Math.abs((dx * s + dz * c) / ref.scale.z) < 3;
        })) { blocked++; break; }
      }
    }
    const hugged = blocked >= 3; lensHits += +hugged; courierHits += +courier;
    expect(methods.huggedOccluder.call(context, view)).toBe(hugged);
    expect(methods.occluded.call(context, view, player)).toBe(courier);
  }
  expect(lensHits).toBeGreaterThan(0); expect(lensHits).toBeLessThan(100);
  expect(courierHits).toBeGreaterThan(0); expect(courierHits).toBeLessThan(100);
});
