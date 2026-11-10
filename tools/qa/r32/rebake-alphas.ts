/** r32-alphas: re-bake only the five humanoid Alpha looks (their atlases carry the Alpha move set) and swap their entries in
 * src/assets/civilianBakes.json. node --import tsx/esm tools/qa/r32/rebake-alphas.ts */
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import manifest from '../../../src/assets/manifest.json';
import { skinCrowdBakes } from '../../assets/skin-crowd-bakes';
import { alphaLooks } from '../../../src/data/alphaLooks';
import type { AssetDef } from '../../../src/assets/types';

const path = 'src/assets/civilianBakes.json', files: Record<string, string> = JSON.parse(readFileSync(path, 'utf8'));
for (const id of alphaLooks['inf.alpha']) {
  const def = manifest.find(d => d.id === id) as AssetDef | undefined;
  if (!def?.crowdSkin) throw new Error(`${id} is not a crowd skin`);
  const fresh = await skinCrowdBakes(def);
  for (const [key, file] of Object.entries(fresh)) {
    const old = files[key]; files[key] = file;
    if (old && old !== file && existsSync(`public${old}`)) unlinkSync(`public${old}`);
    console.log(key, old === file ? 'unchanged' : `${old} -> ${file}`);
  }
}
writeFileSync(path, JSON.stringify(files, null, 2) + '\n');
