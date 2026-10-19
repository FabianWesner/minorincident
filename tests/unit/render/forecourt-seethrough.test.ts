import { expect, test } from 'vitest';
import { Box3, BoxGeometry, BufferAttribute, Mesh, Object3D, PerspectiveCamera, Scene, Vector3, type InterleavedBufferAttribute } from 'three/webgpu';
import { seeThrough } from '../../../src/render/SeeThrough';
import { DistrictView } from '../../../src/render/DistrictView';
import { InstancedGroup } from '../../../src/render/InstancedGroup';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import type { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import { isUncutProp } from '../../../src/assets/DistrictAssets';

test('PO #3 only the garage between camera and courier dissolves; its batched neighbour stays opaque through LOD changes', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const material = materials.get('brick').seeThrough(); material.userData.batchFeatures = '0:0:0';
  const geometry = new BoxGeometry(2, 8, 2), prototype = new Mesh(geometry, material);
  const blocking = new Object3D(), neighbour = new Object3D();
  blocking.position.set(6, 0, 6); neighbour.position.set(6, 0, -6);
  const refs = [blocking, neighbour];
  const hero = new InstancedGroup(prototype, refs), near = new InstancedGroup(prototype, refs), far = new InstancedGroup(prototype, refs);
  const camera = new PerspectiveCamera(); camera.position.set(10, 8, 10);
  camera.lookAt(0, .72, 0); camera.updateMatrixWorld();
  const view = Object.assign(Object.create(DistrictView.prototype), {
    interiorBuildings: [], interiorPose: { x: Infinity, y: Infinity, z: Infinity }, interiorRevision: 0, appliedInteriorRevision: -1, appliedInteriorCullOff: false,
    lensPlacements: new Set(), cutPlacements: new Set<Object3D>(), occluderId: '',
    foliage: { update() {}, reveal: true }, updateRoofs() {}, frameSeconds: 1,
    lensRay: new Vector3(), lensPoint: new Vector3(), holeTarget: new Vector3(), holeCorner: new Vector3(), subjectBox: new Box3(),
    subjectPoints: Array.from({ length: 9 }, () => new Vector3()),
    lodBatches: [{ id: 'bld.garage-detached', height: 8, half: 1, origin: [0, 0], foot: { cx: 0, cz: 0, hx: 1, hz: 1 }, refs, hero, near, far }],
  }) as DistrictView;
  try {
    view.updateFoliage({ camera, driving: false } as Parameters<DistrictView['updateFoliage']>[0], { x: 0, y: .72, z: 0 });
    for (const batch of [hero, near, far]) {
      const mesh = batch.children[0] as Mesh;
      const eligible = mesh.geometry.getAttribute('_occluder');
      // Before the fix the shared material cuts both instances, without an eligibility attribute.
      expect(eligible?.getX(0) ?? 1).toBe(1); expect(eligible?.getX(1) ?? 1, 'unrelated neighbour remains opaque').toBe(0);
      expect((mesh.material as PaletteMaterial).userData.seeThrough).toBe('placement');
      expect(mesh.geometry.getAttribute('position').array).toBe(geometry.getAttribute('position').array);
      batch.references.reverse(); batch.update();
      expect(eligible.getX(0)).toBe(0); expect(eligible.getX(1)).toBe(1);
      batch.references.reverse();
    }
    expect(geometry.hasAttribute('_occluder')).toBe(false);
    geometry.setAttribute('_lightBase', new BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
    const windows = new InstancedGroup(prototype, refs);
    try {
      const mesh = windows.children[0] as Mesh;
      const power = mesh.geometry.getAttribute('_lightBase') as InterleavedBufferAttribute;
      const mask = mesh.geometry.getAttribute('_occluder') as InterleavedBufferAttribute;
      expect(mask.data).toBe(power.data);
      expect('isInstancedInterleavedBuffer' in mask.data).toBe(true);
    } finally { windows.dispose(); }
    expect(isUncutProp('prop.recycling-bin', 1), 'short drawn LODs stay whole even when the manifest is taller').toBe(true);
    expect(isUncutProp('prop.recycling-bin', 1.1165), 'LOD0 detail a few cm above the limit stays whole too').toBe(true);
    expect(isUncutProp('bld.garage-detached', 1)).toBe(false);
  } finally { hero.dispose(); near.dispose(); far.dispose(); geometry.dispose(); materials.dispose(); lighting.dispose(); }
});

test('@E22 lens-enclosing or frame-filling placement clears its foreground without cutting a neighbouring building, and restores across LOD changes', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const material = materials.get('brick').seeThrough(); material.userData.batchFeatures = '0:0:0';
  const geometry = new BoxGeometry(12, 18, 12), prototype = new Mesh(geometry, material); prototype.position.y = 9;
  const blocking = new Object3D(), neighbour = new Object3D(); neighbour.position.z = 30;
  const refs = [blocking, neighbour];
  const hero = new InstancedGroup(prototype, [...refs]), near = new InstancedGroup(prototype, [...refs]), far = new InstancedGroup(prototype, [...refs]);
  const camera = new PerspectiveCamera(25, 16 / 9, .1, 600);
  const district = Object.assign(Object.create(DistrictView.prototype), {
    interiorBuildings: [], interiorPose: { x: Infinity, y: Infinity, z: Infinity }, interiorRevision: 0, appliedInteriorRevision: -1, appliedInteriorCullOff: false,
    foliage: { update() {}, reveal: true }, updateRoofs() {}, frameSeconds: 1,
    cutPlacements: new Set<Object3D>(), lensPlacements: new Set<Object3D>(), occluderId: '',
    lensRay: new Vector3(), lensPoint: new Vector3(), holeTarget: new Vector3(), holeCorner: new Vector3(), subjectBox: new Box3(),
    subjectPoints: Array.from({ length: 9 }, () => new Vector3()),
    lodBatches: [{ id: 'bld.apartment-block-a', height: 18, half: 6, origin: [0, 0], foot: { cx: 0, cz: 0, hx: 6, hz: 6 }, refs, hero, near, far }],
  }) as DistrictView;
  const update = (y: number, x = 0) => {
    camera.position.set(x, y, 0); camera.lookAt(-12, .7, 0); camera.updateMatrixWorld();
    district.updateFoliage({ camera } as Parameters<DistrictView['updateFoliage']>[0], { x: -12, y: .72, z: 0 });
  };
  try {
    update(10); // The lens is inside the apartment, while the courier is outside.
    const radius = seeThrough.solidRadius.value;
    for (const batch of [hero, near, far]) {
      const mask = (batch.children[0] as Mesh).geometry.getAttribute('_occluder');
      expect(mask.getX(0)).toBe(2); expect(mask.getX(1)).toBe(0);
      batch.references.reverse(); batch.update();
      expect(mask.getX(0)).toBe(0); expect(mask.getX(1)).toBe(2);
      batch.references.reverse(); batch.update();
    }
    expect(radius).toBeLessThan(.5); // No global full-screen reveal.
    update(10, 7.5); // Keep the cut while the lens clears the facade's 2 m margin.
    for (const batch of [hero, near, far]) expect((batch.children[0] as Mesh).geometry.getAttribute('_occluder').getX(0)).toBe(2);
    update(18, 10); // Wider zoom can leave the lens outside the box while its facade fills the viewport.
    for (const batch of [hero, near, far]) expect((batch.children[0] as Mesh).geometry.getAttribute('_occluder').getX(0)).toBe(2);
    update(30); // Roof between lens and courier, but the lens is well above it.
    for (const batch of [hero, near, far]) expect((batch.children[0] as Mesh).geometry.getAttribute('_occluder').getX(0)).toBe(1);
    district.seeThroughOff = true; update(10);
    for (const batch of [hero, near, far]) expect((batch.children[0] as Mesh).geometry.getAttribute('_occluder').getX(0)).toBe(0);
  } finally { hero.dispose(); near.dispose(); far.dispose(); geometry.dispose(); materials.dispose(); lighting.dispose(); }
});
