import { expect, test } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import { assetReferences, dataReferences } from '../../../tools/assets/references';

test('T-E17-05d @E17-AC05 data references all resolve to a declared manifest ID', () => {
  const references = dataReferences();
  for (const id of references) expect(manifest.some((a)=>a.id===id),id).toBe(true);
  expect(assetReferences("{ asset: 'veh.fire-engine', assetId: 'inf.common-worker' }")).toEqual(['veh.fire-engine','inf.common-worker']);
  // Earlier epics have not added their catalogs yet; the check covers them as they land.
  for (const id of ['veh.fire-engine','inf.common-worker','char.survivor-female','wpn.baseball-bat']) expect(manifest.some((a)=>a.id===id)).toBe(true);
});

test('T-E17-sources @E17-AC05 every supplied standalone export and LOD is registered', () => {
  for (const directory of readdirSync('assets', { withFileTypes: true })) {
    const source = `assets/${directory.name}/model.glb`;
    if (!directory.isDirectory() || !existsSync(source)) continue;
    const def = manifest.find(asset => asset.id === directory.name);
    expect(def?.sourceGlb, directory.name).toBe(source);
    for (const lod of ['lod1', 'lod2'] as const) {
      const source = `assets/${directory.name}/model.${lod}.glb`;
      if (existsSync(source)) expect(def?.lods?.[lod], source).toBe(def?.glb.replace('.glb', `.${lod}.glb`));
    }
  }
});
