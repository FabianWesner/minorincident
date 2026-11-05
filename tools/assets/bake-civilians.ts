import { readFileSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';
import { coreCivilianModels } from '../../src/data/npcs';
import { l6CastModels } from '../../src/data/l6';
import { skinCrowdBakes } from './skin-crowd-bakes';
import type { AssetDef } from '../../src/assets/types';

// Run after changing figure sources, palette, clips or preparation code.
// The companion uses its hero rig instead of crowd bakes.
const lod2Only = process.argv.includes('--lod2');
const files: Record<string, string> = lod2Only ? JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) : {};
for (const id of [...new Set([...coreCivilianModels, ...l6CastModels])]) {
  if (!manifest.find(def => def.id === id)?.crowdSkin) throw new Error(`${id} must use the v2 crowd contract`);
}
for (const def of manifest.filter(def => def.id !== 'char.corgi' && def.crowdSkin).sort((a, b) => a.id.localeCompare(b.id))) {
  Object.assign(files, await skinCrowdBakes(def as AssetDef, lod2Only ? ['lod2'] : undefined));
}
writeFileSync('src/assets/civilianBakes.json', JSON.stringify(files, null, 2) + '\n');
console.log(`${Object.keys(files).length} skinned crowd bakes`);
