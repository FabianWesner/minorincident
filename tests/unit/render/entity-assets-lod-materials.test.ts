import { expect, test, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, Scene, Vector3 } from 'three/webgpu';
import { EntityAssets } from '../../../src/render/EntityAssets';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';
import type { SimWorld } from '../../../src/sim/world/SimWorld';
import type { EntitySnapshot } from '../../../src/sim/world/types';
import type { PaletteMaterial } from '../../../src/render/PaletteMaterial';
import type { AssetRegistry } from '../../../src/assets/registry';

test('T-E22-20-hidden-prewarm @E22-AC20 focused reveal warm-up draws hidden mission actors and restores their visibility', () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), assets = new EntityAssets({} as SimWorld, false, materials);
  const model = new Group(), material = materials.fromVertexColors('static-colors').frozenCopy().seeThrough();
  model.visible = false; model.position.set(1, 2, 3); assets.add(model);
  const records = (assets as unknown as { records: Map<number, { model: Group; reveal: PaletteMaterial[] }> }).records;
  records.set(5, { model, reveal: [material] });
  try {
    const restore = assets.prewarmReveal(new Vector3(40, 4, 10), false);
    expect(model.visible, 'a hidden helicopter must draw both reveal graphs behind loading').toBe(true);
    restore(); expect(model.visible).toBe(false); expect(model.position.toArray()).toEqual([1, 2, 3]);
    expect(material.userData.seeThrough).toBe(true);
  } finally { assets.dispose(); material.dispose(); materials.dispose(); lighting.dispose(); }
});

test('T-E22-20-collapse-materials @E22-AC20 late glass and crater assets borrow the warmed rigid actor graph', async () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), geometry = new BoxGeometry();
  const assets = new EntityAssets({} as SimWorld, false, materials);
  const internal = assets as unknown as { registry: AssetRegistry; actorModel(id: string, lod: string): Promise<Group> };
  vi.spyOn(internal.registry, 'definition').mockReturnValue({ lods: { lod1: {}, lod2: {} } } as ReturnType<AssetRegistry['definition']>);
  vi.spyOn(internal.registry, 'loadAsset').mockImplementation(async id => {
    const root = new Group(); root.userData.assetId = id;
    root.add(new Mesh(geometry, materials.get('picketWhite'))); return root;
  });
  const material = (root: Group) => (root.getObjectByName('static-body') as Mesh).material as PaletteMaterial;
  try {
    const bus = material(await internal.actorModel('veh.evac-bus', 'lod2'));
    for (const id of ['veh.evac-bus', 'decay.broken-glass', 'decay.fuel-truck-crater']) for (const lod of ['lod0', 'lod1', 'lod2']) {
      const next = material(await internal.actorModel(id, lod));
      expect(next === bus, `${id}/${lod} must borrow the warmed feature graph`).toBe(true);
      expect(next.outputNode).toBe(bus.outputNode);
    }
    const disposed = vi.spyOn(bus, 'dispose'); assets.dispose(); expect(disposed).toHaveBeenCalledTimes(1);
  } finally { geometry.dispose(); materials.dispose(); lighting.dispose(); }
});

test('T-E22-20-setpiece-materials @E22-AC20 @E18-AC05 actor LODs retain reveal graphs without sharing state between actors', async () => {
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), geometry = new BoxGeometry();
  const source = materials.fromVertexColors('static-colors');
  const player = { id: 1, transform: { x: 0, y: .7, z: 0, yaw: 0 } } as EntitySnapshot;
  const actor = (id: number) => ({ id, kind: 'setpiece', archetype: 'veh.evac-bus', transform: { x: id, y: .7, z: 0, yaw: 0 }, health: { current: 1, max: 1 } }) as EntitySnapshot;
  const entities = new Map([player, actor(5), actor(6)].map(e => [e.id, e]));
  const world = { entities: { iterate: () => entities.values(), get: (id: number) => entities.get(id) }, npcs: {} } as SimWorld;
  const assets = new EntityAssets(world, false, materials);
  const model = () => { const root = new Group(); root.add(new Mesh(geometry, source), new Mesh(geometry, source)); return root; };
  const internal = assets as unknown as { actorModel(id: string, lod: string): Promise<Group>; records: Map<number, { model: Group; reveal: PaletteMaterial[]; lod: string }> };
  vi.spyOn(internal, 'actorModel').mockImplementation(async () => model());
  await assets.ready();
  const a = internal.records.get(5)!, b = internal.records.get(6)!;
  expect(a.reveal).toHaveLength(1); expect(a.reveal[0]).not.toBe(b.reveal[0]);
  a.reveal[0].seeThrough(false); b.reveal[0].seeThrough(true);
  const opaque = a.reveal[0].outputNode, cutaway = b.reveal[0].outputNode;
  const restore = assets.prewarmReveal();
  expect(a.reveal[0].userData.seeThrough).toBe(true); restore();
  expect(a.reveal[0].outputNode).toBe(opaque); expect(b.reveal[0].outputNode).toBe(cutaway);
  const position = a.model.position.clone(), simPosition = { ...entities.get(5)!.transform };
  const restoreFocused = assets.prewarmReveal(new Vector3(40, 4, 10), false);
  expect(a.model.position.toArray()).toEqual([40, 4, 10]);
  restoreFocused(); expect(a.model.position.toArray()).toEqual(position.toArray());
  expect(entities.get(5)!.transform).toEqual(simPosition);
  const retired = vi.spyOn(a.reveal[0], 'dispose');
  for (const x of [100, 0, 100, 0]) {
    player.transform.x = x; await assets.ready();
    const current = internal.records.get(5)!;
    expect(current.reveal[0]).toBe(a.reveal[0]); expect(current.model).not.toBe(a.model);
    expect(current.reveal[0].userData.seeThrough).toBe(false);
    expect(internal.records.get(6)!.reveal[0].userData.seeThrough).toBe(true);
    expect(retired).not.toHaveBeenCalled();
  }
  assets.dispose(); expect(retired).toHaveBeenCalledTimes(1);
  geometry.dispose(); materials.dispose(); lighting.dispose();
});
