import { expect, test } from 'vitest';
import { vehicles, requiredVehicleNodes, validateVehicle } from '../../src/data/vehicles';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { atLeast } from '../../src/assets/types';
import { vehiclePlaceholder } from '../../src/assets/vehiclePlaceholder';
import { assetIO } from '../../tools/assets/io';
test('T-E09-01 @E09-AC01 roster validates and every used asset has its complete vehicle node contract', async () => {
  const io = await assetIO();
  expect(vehicles).toHaveLength(7); expect(new Set(vehicles.map(v => v.id)).size).toBe(7);
  for (const vehicle of vehicles) {
    expect(() => validateVehicle(vehicle)).not.toThrow();
    const def = manifest.find(a => a.id === vehicle.asset) as AssetDef;
    expect(def).toBeDefined();
    const required = requiredVehicleNodes(vehicle);
    if (atLeast(def.status, 'integrated')) {
      for (const path of [def.glb, def.lods?.lod1, def.lods?.lod2]) {
        expect(path).toBeTruthy(); const doc = await io.read(path!); const nodes = doc.getRoot().listNodes().map(n => n.getName());
        for (const name of required) expect(nodes, `${path}: ${name}`).toContain(name);
      }
    } else { const model = vehiclePlaceholder(vehicle); for (const name of required) expect(model.getObjectByName(name), `${def.id}: ${name}`).toBeTruthy(); }
    for (const key of ['mass', 'wheelbase', 'hp', 'topSpeed'] as const) expect(() => validateVehicle({ ...vehicle, [key]: NaN })).toThrow();
  }
});
