import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { optimizeAsset } from '../../tools/assets/optimize';
const definition = (manifest as AssetDef[]).find(a => a.id === 'acc.headlamp')!;
for (const suffix of ['', '.lod1', '.lod2']) await optimizeAsset(`assets/acc.headlamp/model${suffix}.glb`, `public/assets/models/acc.headlamp${suffix}.glb`, definition);
