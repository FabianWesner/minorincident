import { readFileSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { optimizeAsset } from '../assets/optimize';
import { assetIO } from '../assets/io';
import { meshopt, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { consolidateMeshopt } from '../assets/compress';
// `--only bld.a,bld.b` re-optimizes just those assets (and skips the shared ground layout).
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
for (const def of manifest as AssetDef[]) if (def.decayVariants.includes('w6') && (!only || only.includes(def.id))) {
  for (const lod of [0, 1, 2]) {
    const suffix = lod ? `.lod${lod}` : '';
    await optimizeAsset(`assets/${def.id}/model.w6${suffix}.glb`, `public/assets/models/${def.id}.w6${suffix}.glb`, def);
  }
}
if (!only) {
const io = await assetIO(), path = 'public/assets/layouts/D-FAIR.w6.glb';
const doc = await io.read(path);
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high', quantizePosition: 16, quantizeNormal: 8 }), prune({ keepLeaves: true }));
writeFileSync(path, await consolidateMeshopt(await io.writeBinary(doc)));
console.log(`W6 models optimized; ground ${readFileSync(path).length} bytes`);
}
