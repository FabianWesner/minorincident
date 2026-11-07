/** r2-corpse: CPU cost of repairDeathPoses per delivered model/LOD (node, one core). */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData.ts';
import { packCrowdParts } from '../../src/assets/crowdParts.ts';
import { repairDeathPoses } from '../../src/render/characters/deathPose.ts';
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
for (const key of ['inf.alpha:lod0', 'inf.alpha:lod2', 'inf.common-worker:lod0', 'inf.common-worker:lod2', 'inf.mega-alpha:lod0', 'inf.riot-cop:lod2']) {
  const b = gunzipSync(readFileSync(`public${deliveries[`${key}:infected`]}`));
  const baked = decodeCivilianBake(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  packCrowdParts(baked.geometry);
  const t = performance.now();
  repairDeathPoses(baked.clip, baked.geometry, { prone: key.includes('alpha') });
  console.log(key, 'vertices', baked.geometry.getAttribute('position').count, 'ms', (performance.now() - t).toFixed(0));
}
