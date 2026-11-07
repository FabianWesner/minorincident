/** r2-corpse debug: where are the highest vertices of the repaired death-back pose? (part, rest position, final x/y/z) */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData.ts';
import { repairDeathPoses } from '../../src/render/characters/deathPose.ts';
import { packCrowdParts } from '../../src/assets/crowdParts.ts';
import { premultiplyRow, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd.ts';
import { framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected.ts';
const model = process.argv[2] ?? 'inf.alpha', death = process.argv[3] ?? 'death-back';
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
const bytes = gunzipSync(readFileSync(`public${deliveries[`${model}:lod0:infected`]}`));
const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
packCrowdParts(baked.geometry);
repairDeathPoses(baked.clip, baked.geometry, { prone: /alpha/.test(model) });
const P = baked.clip.parts.length, frame = infectedClips.indexOf(death) * framesPerClip + framesPerClip - 1;
const g = baked.geometry, p = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin');
const offset = frame * P * 16, pose = new Float32Array(P * 16), m = new Float32Array(16);
premultiplyRow(baked.clip.matrices, pose, baked.clip.binds, offset, P, 0);
const buckets = new Map();
for (let i = 0; i < p.count; i++) {
  if (parts.getZ(i) > 1.5 || parts.getW(i) >= 1024) continue;
  skinnedVertexMatrix(baked.clip, offset, parts, skin, i, m, pose);
  const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
  const Y = m[1] * x + m[5] * y + m[9] * z + m[13], X = m[0] * x + m[4] * y + m[8] * z + m[12], Z = m[2] * x + m[6] * y + m[10] * z + m[14];
  const key = `${baked.clip.parts[parts.getX(i)]} x${Math.round(X * 4) / 4} z${Math.round(Z * 4) / 4}`;
  const b = buckets.get(key) ?? { top: -1, n: 0, rest: null }; b.n++; if (Y > b.top) { b.top = Y; b.rest = [x, y, z].map(v => +v.toFixed(2)); } buckets.set(key, b);
}
console.log([...buckets].filter(([, b]) => b.top > 0.9).sort((a, b) => b[1].top - a[1].top).slice(0, 25).map(([k, b]) => `${k} top ${b.top.toFixed(2)} n=${b.n} rest ${b.rest}`).join('\n'));
