import { expect, test, vi } from 'vitest';
import { Group, Vector3 } from 'three/webgpu';
import type { Node } from '@gltf-transform/core';
import { AssetRegistry } from '../../../src/assets/registry';
import { BicycleView } from '../../../src/render/BicycleView';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { Materials } from '../../../src/render/Materials';
import manifest from '../../../src/assets/manifest.json';
import { assetIO } from '../../../tools/assets/io';
import { triangleCount } from '../../../tools/assets/delivery';

const positions: Record<string, number[]> = {
  seat: [-.65, 1.16, 0], grip_l: [-.23, 1.175, -.29], grip_r: [-.23, 1.175, .29],
  pedal_l: [-.39, .22, -.18], pedal_r: [-.55, .38, .18], box_lid_top: [.53, .89, 0],
  wheel_front: [1.035, .335, 0], wheel_rear: [-.94, .405, 0],
  crank: [-.47, .30, 0], kickstand: [-.10, .32, 0], handlebar: [-.075, 1.065, 0],
};
test('courier bike keeps authored two-wheel assemblies and attachment pivots in all packed LODs @E17', async () => {
  const io = await assetIO(), def = manifest.find(entry => entry.id === 'veh.courier-bike')!;
  let base = 0;
  for (const [level, path] of [def.glb, def.lods!.lod1!, def.lods!.lod2!].entries()) {
    const document = await io.read(path), nodes = document.getRoot().listNodes();
    expect(document.getRoot().listScenes()[0].getExtras().deliveryLodGenerated).not.toBe(true);
    const count = triangleCount(document);
    if (!level) base = count;
    else expect(count / base).toBeLessThanOrEqual(level === 1 ? .155 : .045);
    for (const [name, point] of Object.entries(positions)) {
      const node = nodes.find(node => node.getName() === name)!;
      expect(node, name).toBeDefined();
      node.getWorldTranslation().forEach((coordinate, axis) => expect(coordinate, name).toBeCloseTo(point[axis], 4));
      expect(node.getScale(), name).toEqual([1, 1, 1]);
      expect(node.getRotation(), name).toEqual([0, 0, 0, 1]);
    }
    expect(nodes.filter(node => /^wheel_/.test(node.getName())).map(node => node.getName()).sort()).toEqual(['wheel_front', 'wheel_rear']);
    // Legacy names are empty aliases, so they cannot introduce a third wheel.
    for (const name of ['wheelF', 'wheelR', 'seat', 'grip_l', 'grip_r', 'box_lid_top']) {
      const node = nodes.find(node => node.getName() === name)!;
      expect(node.getMesh(), name).toBeNull();
      expect(node.listChildren(), name).toHaveLength(0);
    }
  }
});


test('courier bike riding retracts the stand and aligns the saddle with the rider', async () => {
  const document = await (await assetIO()).read('public/assets/models/veh.courier-bike.glb');
  const assemble = (node: Node): Group => {
    const group = new Group(); group.name = node.getName();
    group.position.fromArray(node.getTranslation()); group.quaternion.fromArray(node.getRotation());
    group.scale.fromArray(node.getScale());
    for (const child of node.listChildren()) group.add(assemble(child));
    return group;
  };
  const model = new Group();
  for (const node of document.getRoot().listScenes()[0].listChildren()) model.add(assemble(node));
  const bicycle = { mounted: false, speed: 0, steer: 0, pedal: 0 };
  const world = { tick: 0, vehicles: { bicycle: { entity: { bicycle, transform: { x: 0, z: 0, yaw: 0 } } } },
    entities: { get: () => ({ transform: { x: 0, z: 0 }, survivor: { carrying: 'parcel' } }) } } as unknown as SimWorld;
  vi.stubGlobal('document', { createElement: () => ({ dataset: {}, style: {}, remove: () => {} }), querySelector: () => null });
  vi.spyOn(AssetRegistry.prototype, 'loadAsset').mockResolvedValue(model);
  const view = new BicycleView(world, {} as Materials);
  try {
    await view.load();
    expect(model.getObjectByName('kickstand')!.rotation.z).toBe(0);
    bicycle.mounted = true;
    for (let i = 0; i < 60; i++) view.update();
    view.updateMatrixWorld(true);
    expect(model.getObjectByName('kickstand')!.rotation.z).toBeCloseTo(Math.PI / 2);
    // The rider's pelvis is placed on the measured saddle position every frame (GameView.seatPelvis): the view reports the seat node's world position.
    const saddle = new Vector3(); expect(view.seatWorld(saddle)).toBe(true);
    expect(saddle.distanceTo(model.getObjectByName('seat')!.getWorldPosition(new Vector3()))).toBeLessThan(1e-6);
    expect(model.getObjectByName('wheel_front')!.getWorldPosition(new Vector3()).x).toBeGreaterThan(saddle.x);
    bicycle.mounted = false; for (let i = 0; i < 60; i++) view.update();
    expect(model.getObjectByName('kickstand')!.rotation.z).toBeCloseTo(0, 3);
  } finally { view.dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});
