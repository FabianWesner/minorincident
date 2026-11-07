/** Exact delivered corpse surfaces before placement; projection uses production skinning. */
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData.ts';
import { premultiplyRow, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd.ts';
import { packCrowdParts } from '../../src/assets/crowdParts.ts';
import { proneDeath } from '../../src/render/characters/proneDeath.ts';
import { framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected.ts';
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
const result = [];
for (const [key, file] of Object.entries(deliveries)) {
  if (!/^inf\..*:lod0:infected$/.test(key)) continue;
  const bytes = gunzipSync(readFileSync(`public${file}`));
  const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const alpha = key.startsWith('inf.alpha') || key.startsWith('inf.mega-alpha');
  if (alpha && !process.argv.includes('--raw')) proneDeath(baked.clip);
  const g = baked.geometry; if (!g.hasAttribute('_parts')) packCrowdParts(g);
  const p = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin');
  for (const name of ['death-back', 'death-side', 'death-crumple']) {
    const offset = (infectedClips.indexOf(name) * framesPerClip + framesPerClip - 1) * baked.clip.parts.length * 16;
    const pose = new Float32Array(baked.clip.parts.length * 16), m = new Float32Array(16);
    premultiplyRow(baked.clip.matrices, pose, baked.clip.binds, offset, baked.clip.parts.length, 0);
    const extents = {};
    for (let i = 0; i < p.count; i++) {
      if (parts.getZ(i) > 1.5 || parts.getW(i) >= 1024) continue;
      skinnedVertexMatrix(baked.clip, offset, parts, skin, i, m, pose);
      const y = m[1]*p.getX(i)+m[5]*p.getY(i)+m[9]*p.getZ(i)+m[13];
      const part = baked.clip.parts[parts.getX(i)];
      const bounds = extents[part] ??= {min: Infinity,max:-Infinity};
      bounds.min = Math.min(bounds.min, y); bounds.max = Math.max(bounds.max,y);
    }
    result.push({key,name,min:Math.min(...Object.values(extents).map(x=>x.min)),max:Math.max(...Object.values(extents).map(x=>x.max)),extents});
  }
  g.dispose();
}
writeFileSync(`test-results/blk-v/corpse-source-bounds${process.argv.includes('--raw') ? '-raw' : ''}.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result.map(({key,name,min,max})=>({key,name,min,max})),null,2));
