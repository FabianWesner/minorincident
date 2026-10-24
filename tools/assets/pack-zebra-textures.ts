/** Pack reviewed high/low texture siblings without rebuilding or changing their rig. */
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { optimizeAsset } from './optimize';
import { packAsset } from './pack';
for (const id of ['amb.zebra-tex', 'inf.zebra-tex']) {
  const def = manifest.find(a => a.id === id)! as AssetDef;
  await packAsset(def);
  for (const lod of ['', '.lod1', '.lod2']) await optimizeAsset(`assets/${id}/model${lod}.low.glb`, `public/assets/models/${id}${lod}.low.glb`, def);
}
