/** r2-corpse: frozen corpse vertex tops per delivered model and death clip, before (--before) and after the pose repair.
 *  Same method as blk-v-corpse-bounds.mjs (production skinning of the last frame of each death clip, LOD0), plus joint-level fold angles. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Vector3 } from 'three';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData.ts';
import { premultiplyRow, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd.ts';
import { packCrowdParts } from '../../src/assets/crowdParts.ts';
import { repairDeathPoses } from '../../src/render/characters/deathPose.ts';
import { proneDeath } from '../../src/render/characters/proneDeath.ts';
import { framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected.ts';
const before = process.argv.includes('--before'), lodArg = process.argv.find(a => a.startsWith('--lod='))?.slice(6) ?? 'lod0';
const only = process.argv.find(a => a.startsWith('--model='))?.slice(8);
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
const result = [];
for (const [key, file] of Object.entries(deliveries)) {
  if (!key.endsWith(`:${lodArg}:infected`) || !key.startsWith('inf.') || (only && !key.startsWith(only + ':'))) continue;
  const bytes = gunzipSync(readFileSync(`public${file}`));
  const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const alpha = /^inf\.(mega-)?alpha/.test(key);
  const g = baked.geometry; if (!g.hasAttribute('_parts')) packCrowdParts(g);
  if (before) { if (alpha) proneDeath(baked.clip); } else repairDeathPoses(baked.clip, g, { prone: alpha });
  const p = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin');
  const P = baked.clip.parts.length, at = (frame, name) => { const o = (frame * P + baked.clip.parts.indexOf(name)) * 16 + 12; return new Vector3(baked.clip.matrices[o], baked.clip.matrices[o + 1], baked.clip.matrices[o + 2]); };
  for (const name of ['death-back', 'death-side', 'death-crumple']) {
    const frame = infectedClips.indexOf(name) * framesPerClip + framesPerClip - 1, offset = frame * P * 16;
    const pose = new Float32Array(P * 16), m = new Float32Array(16);
    premultiplyRow(baked.clip.matrices, pose, baked.clip.binds, offset, P, 0);
    const extents = {};
    for (let i = 0; i < p.count; i++) {
      if (parts.getZ(i) > 1.5 || parts.getW(i) >= 1024) continue;
      skinnedVertexMatrix(baked.clip, offset, parts, skin, i, m, pose);
      const y = m[1] * p.getX(i) + m[5] * p.getY(i) + m[9] * p.getZ(i) + m[13];
      const part = baked.clip.parts[parts.getX(i)];
      const bounds = extents[part] ??= { min: Infinity, max: -Infinity };
      bounds.min = Math.min(bounds.min, y); bounds.max = Math.max(bounds.max, y);
    }
    const bend = (a, b, c) => { try { const u = at(frame, a).sub(at(frame, b)), v = at(frame, c).sub(at(frame, b)); return +(u.angleTo(v) * 180 / Math.PI).toFixed(0); } catch { return null; } };
    result.push({ key, name, min: Math.min(...Object.values(extents).map(x => x.min)), max: Math.max(...Object.values(extents).map(x => x.max)),
      kneeL: bend('legL', 'shinL', 'footL'), kneeR: bend('legR', 'shinR', 'footR'), elbowL: bend('armL', 'foreArmL', 'handL'), elbowR: bend('armR', 'foreArmR', 'handR'),
      hipY: +at(frame, 'hip').y.toFixed(2), extents });
  }
  g.dispose();
}
mkdirSync('test-results/r2', { recursive: true });
writeFileSync(`test-results/r2/bounds-${before ? 'before' : 'after'}-${lodArg}.json`, JSON.stringify(result, null, 1) + '\n');
console.log(result.map(r => `${r.key.split(':')[0].padEnd(22)} ${r.name.padEnd(13)} max ${r.max.toFixed(2)} min ${r.min.toFixed(2)} knees ${r.kneeL}/${r.kneeR} elbows ${r.elbowL}/${r.elbowR}`).join('\n'));
