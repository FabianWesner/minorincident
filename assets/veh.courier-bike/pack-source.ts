/** Compact the three authored tiers without simplification before assets:pack. */
import manifest from '../../src/assets/manifest.json';
import { optimizeAsset } from '../../tools/assets/optimize';
const def = manifest.find(entry => entry.id === 'veh.courier-bike')!;
for (const suffix of ['', '.lod1', '.lod2']) {
  const path = `assets/${def.id}/model${suffix}.glb`;
  await optimizeAsset(path, path, def);
}
