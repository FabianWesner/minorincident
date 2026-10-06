import { expect, test } from 'vitest';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import manifest from '../../../src/assets/manifest.json';
import { assetReferences, dataReferences } from '../../../tools/assets/references';

test('T-E17-05d @E17-AC05 data references all resolve to a declared manifest ID', () => {
  const references = dataReferences();
  for (const id of references) expect(manifest.some((a)=>a.id===id),id).toBe(true);
  expect(assetReferences("{ asset: 'veh.fire-engine', assetId: 'inf.common-worker' }")).toEqual(['veh.fire-engine','inf.common-worker']);
  // Earlier epics have not added their catalogs yet; the check covers them as they land.
  for (const id of ['veh.fire-engine','inf.common-worker','char.survivor-female','wpn.baseball-bat']) expect(manifest.some((a)=>a.id===id)).toBe(true);
});

test('T-E17-sources @E17-AC05 every integrated standalone export and LOD is registered and exported', () => {
  // Source models can arrive before runtime integration. Data IDs are checked above;
  // only integrated/final assets promise registered runtime exports.
  const sources = new Set(execFileSync('git', ['ls-files', '-z', 'assets/*/model*.glb'], { encoding: 'utf8' }).split('\0').filter(Boolean));
  for (const source of sources) {
    if (!source.endsWith('/model.glb')) continue;
    const id = source.split('/')[1];
    const def = manifest.find(asset => asset.id === id);
    expect(def, id).toBeDefined();
    if (!['integrated','final'].includes(def!.status)) continue;
    expect(def?.sourceGlb, id).toBe(source);
    expect(existsSync(def!.glb), def!.glb).toBe(true);
    for (const lod of ['lod1', 'lod2'] as const) {
      const source = `assets/${id}/model.${lod}.glb`;
      if (sources.has(source) && def.tier === 'hero') expect(def?.lods?.[lod], source).toBe(def?.glb.replace('.glb', `.${lod}.glb`));
      const output = def?.lods?.[lod];
      if (output) expect(existsSync(output), output).toBe(true);
    }
  }
});
