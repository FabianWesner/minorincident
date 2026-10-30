import { readFileSync, writeFileSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json';
import type { AssetDef } from '../../src/assets/types';
import { skinCrowdBakes } from '../assets/skin-crowd-bakes';

const files = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
const selected = process.argv.slice(2);
for (const def of manifest.filter(def => def.id.startsWith('npc.') && def.crowdSkin && (!selected.length || selected.includes(def.id)))) {
  Object.assign(files, await skinCrowdBakes(def as AssetDef));
  console.log(`rebuilt ${def.id}`);
}
writeFileSync('src/assets/civilianBakes.json', JSON.stringify(files, null, 2) + '\n');
