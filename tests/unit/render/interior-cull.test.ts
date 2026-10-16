import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, InstancedMesh, Mesh, MeshBasicNodeMaterial, Object3D } from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { staticBatch } from '../../../src/assets/staticBatch';
import { InstancedGroup } from '../../../src/render/InstancedGroup';
import { DistrictView } from '../../../src/render/DistrictView';

const prototype = () => {
  const source = new Group(); source.userData.assetId = 'bld.supermarket';
  const material = new MeshBasicNodeMaterial({ color: 'white' }); material.name = 'pal_sidewalk';
  source.add(new Mesh(new BoxGeometry(8, 3, 8), material));
  const interior = new Group(); interior.name = 'interior';
  // The shipped GLB packs masonry and stock into the same material primitive.
  const stock = new BoxGeometry(1, 1, 1), wall = new BoxGeometry(.2, 3, 8).translate(3.9, 0, 0);
  interior.add(new Mesh(mergeGeometries([stock, wall]), material)); source.add(interior);
  stock.dispose(); wall.dispose();
  return staticBatch(source, true);
};

test('@E18 embedded shop stock stays separate from the shell and compacts per building across repartition', () => {
  const source = prototype(), a = new Object3D(), b = new Object3D(); b.position.x = 20;
  expect(source.children.filter(n => n.userData.interior)).toHaveLength(1);
  const shell = source.children.filter(n => !n.userData.interior) as Mesh[];
  expect(shell.reduce((n, mesh) => n + mesh.geometry.index!.count / 3, 0)).toBe(24);
  expect((source.children.find(n => n.userData.interior) as Mesh).geometry.index!.count / 3).toBe(12);
  const group = new InstancedGroup(source, [a, b]);
  const stock = group.children.find(n => n.name === 'static-body' && (n as InstancedMesh).geometry === (source.children.find(n => n.userData.interior) as Mesh).geometry) as InstancedMesh;
  group.interiorVisible(false, a); group.interiorVisible(false, b);
  expect(stock.count).toBe(0); expect(stock.visible).toBe(false);
  group.interiorVisible(true, b);
  expect(stock.count).toBe(1); expect(stock.instanceMatrix.array[12]).toBe(20);
  group.seeThrough(true, b); expect(stock.count).toBe(1);
  group.references.splice(0, 2, b, a); group.update();
  expect(stock.count).toBe(1); expect(stock.instanceMatrix.array[12]).toBe(20);
  group.interiorVisible(false, b); expect(stock.count).toBe(0);
  group.dispose(); source.traverse(n => { if (n instanceof Mesh) n.geometry.dispose(); });
});

test('@E18 footprints tag enclosed placements and reveal/inside transitions update before rendering', () => {
  const ref = new Object3D(); ref.rotation.y = Math.PI / 2; ref.position.set(10, 0, 10); ref.scale.set(2, 1, 1);
  const prop = new Object3D(); prop.position.set(10, .1, 10);
  const street = new Object3D(); street.position.set(10, .1, 18.5);
  const group = () => ({ interiorVisible: vi.fn() });
  const building = { id: 'bld.supermarket', refs: [ref], origin: [100, 200], foot: { cx: 0, cz: 0, hx: 4, hz: 4 }, height: 4, hero: group(), near: group(), far: group() };
  const props = { hero: group(), id: 'prop.bench', refs: [prop, street], origin: [100, 200], foot: { cx: 0, cz: 0, hx: .5, hz: .5 }, height: 1 };
  const flashlight = new Object3D(); flashlight.position.set(10, .2, 10);
  const { hero: _hero, ...dressingBase } = props; void _hero;
  const dressing = { ...dressingBase, id: 'util.flashlight', refs: [flashlight] };
  const partition = vi.fn(), partitionDressing = vi.fn();
  const district = Object.assign(Object.create(DistrictView.prototype), {
    interiorBuildings: [], interiorPose: { x: Infinity, y: Infinity, z: Infinity }, interiorRevision: 0, appliedInteriorRevision: -1, appliedInteriorCullOff: false, lodBatches: [building, props], dressingEntries: [dressing], dirtyEntries: new Set(), partition, partitionDressing });
  district.tagInteriors();
  expect(prop.userData.interiorBuilding).toBe(ref); expect(street.userData.interiorBuilding).toBeUndefined();
  expect(flashlight.userData.interiorBuilding).toBe(ref);
  const view = {};
  district.updateInteriors(view, { x: 130, y: .7, z: 230 });
  expect(prop.userData.interiorHidden).toBe(true); expect(partition).toHaveBeenCalledWith(props, view);
  expect(flashlight.userData.interiorHidden).toBe(true); expect(partitionDressing).toHaveBeenCalledWith(dressing);
  ref.userData.occluder = true; district.interiorRevision++;
  district.updateInteriors(view, { x: 130, y: .7, z: 230 });
  expect(prop.userData.interiorHidden).toBe(false); expect(building.hero.interiorVisible).toHaveBeenLastCalledWith(true, ref);
  ref.userData.occluder = false; district.interiorRevision++;
  district.updateInteriors(view, { x: 110, y: .7, z: 210 }); expect(prop.userData.interiorHidden).toBe(false);
  district.updateInteriors(view, { x: 110, y: 6, z: 210 }); expect(prop.userData.interiorHidden).toBe(true);
  partition.mockClear(); district.updateInteriors(view, { x: 110, y: 6, z: 210 }); expect(partition).not.toHaveBeenCalled();
  const start = performance.now(); for (let i = 0; i < 10000; i++) district.updateInteriors(view, { x: 130, y: .7, z: 230 });
  console.log('interior visibility steady cost ms/building', (performance.now() - start) / 10000);
});
