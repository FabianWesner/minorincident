import { expect, test } from 'vitest';
import { vehicles, requiredVehicleNodes, validateVehicle } from '../../src/data/vehicles';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { atLeast, variantPath } from '../../src/assets/types';
import { Group } from 'three/webgpu';
import { prepareTransportModel } from '../../src/render/transportModel';
import { vehiclePlaceholder } from '../../src/assets/vehiclePlaceholder';
import { assetIO } from '../../tools/assets/io';
test('T-E09-01 @E09-AC01 roster validates and every used asset has its complete vehicle node contract', async () => {
  const io = await assetIO();
  expect(vehicles).toHaveLength(8); expect(new Set(vehicles.map(v => v.id)).size).toBe(8);
  for (const vehicle of vehicles) {
    expect(() => validateVehicle(vehicle)).not.toThrow();
    // The APC variant is owned by L8-D2; its runtime derivative supplies seats meanwhile.
    const def = manifest.find(a => a.id === vehicle.asset) as AssetDef;
    expect(def).toBeDefined();
    const required = requiredVehicleNodes(vehicle);
    if (atLeast(def.status, 'integrated')) {
      for (const path of [def.glb, def.lods?.lod1, def.lods?.lod2]) {
        expect(path).toBeTruthy(); const doc = await io.read(variantPath(path!, vehicle.bodyVariant && def.decayVariants.includes(vehicle.bodyVariant) ? vehicle.bodyVariant : undefined)); const nodes = doc.getRoot().listNodes().map(n => n.getName());
        if (vehicle.transport && !def.decayVariants.includes(vehicle.bodyVariant!)) {
          const model = new Group(); for (const name of nodes) { const node = new Group(); node.name = name; model.add(node); }
          prepareTransportModel(model, vehicle);
          model.traverse(node => { if (!nodes.includes(node.name)) nodes.push(node.name); });
        }
        for (const name of required) expect(nodes, `${path}: ${name}`).toContain(name);
      }
    } else { const model = vehiclePlaceholder(vehicle); for (const name of required) expect(model.getObjectByName(name), `${def.id}: ${name}`).toBeTruthy(); }
    for (const key of ['mass', 'wheelbase', 'hp', 'topSpeed'] as const) expect(() => validateVehicle({ ...vehicle, [key]: NaN })).toThrow();
    for (const key of Object.keys(vehicle.handling) as (keyof typeof vehicle.handling)[]) expect(() => validateVehicle({ ...vehicle, handling: { ...vehicle.handling, [key]: NaN } })).toThrow();
    expect(() => validateVehicle({ ...vehicle, handling: { ...vehicle.handling, engineTaperStart: 1 } })).toThrow();
  }
});

test('T-E09-01-wreck @E09-AC01 @E27-AC05 fire-engine damage tiers preserve wheels/seats and disable authored lamps', async () => {
  const io = await assetIO();
  const def = manifest.find(a => a.id === 'veh.fire-engine') as AssetDef;
  expect(def.decayVariants).toEqual(['wrecked', 'burned']);
  const { variantPath } = await import('../../src/assets/types');
  const { triangleCount } = await import('../../tools/assets/delivery');
  const { geometryHash } = await import('../../tools/assets/validate');
  for (const [lod, path] of [def.glb, def.lods!.lod1!, def.lods!.lod2!].entries()) {
    // Damaged near shell derives from the authored mid shell, whose sockets match near.
    const source = await io.read(lod === 2 ? def.lods!.lod2! : def.lods!.lod1!);
    const anchors = source.getRoot().listNodes();
    const hashes = [geometryHash(source)];
    for (const decay of def.decayVariants) {
      const damaged = await io.read(variantPath(path, decay));
      expect(triangleCount(damaged)).toBeLessThanOrEqual([15000, 6000, 2000][lod]);
      const nodes = damaged.getRoot().listNodes();
      for (const name of [...def.requiredNodes, ...def.sockets]) {
        const node = nodes.find(n => n.getName() === name);
        expect(node, `${decay}/${lod}/${name}`).toBeDefined();
        const sourceNode = anchors.find(n => n.getName() === name)!;
        node!.getWorldMatrix().forEach((value, index) => expect(value).toBeCloseTo(sourceNode.getWorldMatrix()[index], 5));
      }
      for (const name of ['lightsFront', 'lightsBrake', 'sirenL', 'sirenR']) expect(nodes.find(n => n.getName() === name)!.getExtras().damagedLightOff).toBe(true);
      for (const material of damaged.getRoot().listMaterials()) {
        expect(material.getName()).not.toMatch(/^emi_/);
        expect(material.getEmissiveFactor()).toEqual([0, 0, 0]);
      }
      hashes.push(geometryHash(damaged));
    }
    expect(new Set(hashes).size).toBe(3);
  }
});

test('T-E31-03-model @E31-AC03 shared APC and every unarmed LOD contain no mounted gun', async () => {
  const def = vehicles.find(v => v.id === 'vehicle.military-apc')!;
  expect(def.bodyVariant).toBe('unarmed');
  expect([def.mass, def.topSpeed, def.hp, def.ramStrength]).toEqual([6000, 18, 1000, 3]);
  const asset = manifest.find(a => a.id === def.asset) as AssetDef, io = await assetIO();
  for (const path of [asset.glb, asset.lods!.lod1!, asset.lods!.lod2!]) {
    const doc = await io.read(variantPath(path, 'unarmed'));
    expect(doc.getRoot().listNodes().map(n => n.getName()).filter(n => /gun|turret|cannon|barrel|weapon/i.test(n))).toEqual([]);
  }
});
