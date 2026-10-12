import { expect, test } from 'vitest';
import { Group } from 'three/webgpu';
import { assetIO } from '../../../tools/assets/io';
import { vehicleDef, requiredVehicleNodes } from '../../../src/data/vehicles';
import { prepareTransportModel } from '../../../src/render/transportModel';
test('T-E30-14-model @E30-AC14 transport derivative has seats/exits and removes every weapon node on all LODs', async () => {
  const io = await assetIO(), def = vehicleDef('vehicle.military-apc');
  for (const suffix of ['', '.lod1', '.lod2']) {
    const document = await io.read(`public/assets/models/veh.military-apc${suffix}.glb`);
    const model = new Group();
    for (const node of document.getRoot().listNodes()) {
      const copy = new Group(); copy.name = node.getName(); copy.position.fromArray(node.getWorldTranslation()); model.add(copy);
    }
    prepareTransportModel(model, def);
    for (const name of requiredVehicleNodes(def)) expect(model.getObjectByName(name), name).toBeDefined();
    for (const name of ['gun', 'turret', 'muzzle']) expect(model.getObjectByName(name)).toBeUndefined();
    for (const [i, seat] of def.transport!.seats.entries()) expect(model.getObjectByName(`passenger${i}`)!.position.toArray()).toEqual([seat.x, seat.y, seat.z]);
    expect(model.getObjectByName('driverSeat')!.position.y).toBeGreaterThan(1);
  }
});

test('T-E30-14-loader @E30-AC14 unarmed shell loads using its own node contract', async () => {
  const { AssetRegistry } = await import('../../../src/assets/registry');
  const source = new Group(); source.name = 'body';
  const registry = new AssetRegistry(() => {}, { manifest: [{ id: 'veh.test', category: 'vehicle', status: 'integrated', tier: 'hero', glb: 'test.glb', dimensions: { x: 1, y: 1, z: 1, tolerance: .1 }, forward: '+X', frontNodes: [], requiredNodes: ['body', 'gun'], animatedNodes: [], sockets: ['muzzle'], budget: { triangles: 10, materials: 1, fileKB: 10, drawCalls: 1 }, decayVariants: ['unarmed'], decayNodes: { unarmed: { requiredNodes: ['body'], animatedNodes: [], sockets: [] } } }], load: async () => source });
  try { expect((await registry.loadAsset('veh.test', 'lod0', 'unarmed')).userData.placeholder).not.toBe(true); }
  finally { await registry.dispose(); }
});
