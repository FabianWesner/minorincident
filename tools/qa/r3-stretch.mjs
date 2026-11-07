/** r3-corpse: per-model skin stretch of the frozen death poses. Worst triangle edge ratio (death pose / rest pose), no browser. */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { decodeCivilianBake } from '../../src/assets/civilianBakeData.ts';
import { premultiplyRow, skinnedVertexMatrix } from '../../src/render/characters/skinnedCrowd.ts';
import { packCrowdParts } from '../../src/assets/crowdParts.ts';
import { repairDeathPoses } from '../../src/render/characters/deathPose.ts';
import { framesPerClip, infectedClips } from '../../src/render/characters/bakeInfected.ts';
const lod = process.argv.find(a => a.startsWith('--lod='))?.slice(6) ?? 'lod0', only = process.argv.find(a => a.startsWith('--model='))?.slice(8);
const deliveries = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8'));
for (const [key, file] of Object.entries(deliveries)) {
  if (!key.endsWith(`:${lod}:infected`) || !key.startsWith('inf.') || (only && !key.startsWith(only + ':'))) continue;
  const bytes = gunzipSync(readFileSync(`public${file}`));
  const baked = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const alpha = /^inf\.(mega-)?alpha/.test(key), g = baked.geometry;
  if (!g.hasAttribute('_parts')) packCrowdParts(g);
  if (!process.argv.includes("--raw")) repairDeathPoses(baked.clip, g, { prone: alpha });
  const pos = g.getAttribute('position'), parts = g.getAttribute('_parts'), skin = g.getAttribute('_skin'), index = g.index, P = baked.clip.parts.length;
  const world = offset => {
    const pose = new Float32Array(P * 16), m = new Float32Array(16), out = new Float32Array(pos.count * 3);
    premultiplyRow(baked.clip.matrices, pose, baked.clip.binds, offset, P, 0);
    for (let i = 0; i < pos.count; i++) {
      skinnedVertexMatrix(baked.clip, offset, parts, skin, i, m, pose);
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      out[i * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]; out[i * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]; out[i * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
    }
    return out;
  };
  const rest = new Float32Array(pos.array.length), edge = (a, i, j) => Math.hypot(a[i * 3] - a[j * 3], a[i * 3 + 1] - a[j * 3 + 1], a[i * 3 + 2] - a[j * 3 + 2]);
  for (let i = 0; i < pos.count; i++) { rest[i * 3] = pos.getX(i); rest[i * 3 + 1] = pos.getY(i); rest[i * 3 + 2] = pos.getZ(i); }
  const row = [], hist = {};
  for (const name of ['idle', 'death-back', 'death-side', 'death-crumple']) {
    const frame = infectedClips.indexOf(name) * framesPerClip + framesPerClip - 1, a = world(frame * P * 16);
    let worst = 0, partName = '', worstInfo = '';
    const n = index ? index.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      const v = [0, 1, 2].map(k => index ? index.getX(t + k) : t + k);
      for (const [p, q] of [[0, 1], [1, 2], [2, 0]]) {
        if (v.some(i => parts.getZ(i) > 1.5 || parts.getW(i) >= 1024)) continue;
        const r0 = edge(rest, v[p], v[q]); if (r0 < .04) continue;
        const r = edge(a, v[p], v[q]) / r0;
        if (process.argv.includes("--hist") && r > 1.4 && name === "death-back") { const k = baked.clip.parts[parts.getX(v[p])] + "-" + baked.clip.parts[parts.getX(v[q])]; hist[k] = (hist[k] || 0) + 1; (globalThis.top ??= []).push([r, [v[p], v[q]].map(i => { const s = skin.getX(i); return [parts.getX(i), s % 32, Math.floor(s / 32) % 32, Math.floor(s / 1024)].map(j => baked.clip.parts[j]).join("/") + ":" + [skin.getY(i), skin.getZ(i), skin.getW(i) % 1].map(x => x.toFixed(2)).join(","); }).join(" || ")]); }
        if (r > worst) { worst = r; partName = baked.clip.parts[parts.getX(v[p])]; if (process.argv.includes("--dump") && name !== "idle") worstInfo = [v[p], v[q]].map(i => { const s = skin.getX(i); return `${i} rest(${rest[i*3].toFixed(2)},${rest[i*3+1].toFixed(2)},${rest[i*3+2].toFixed(2)}) pose(${a[i*3].toFixed(2)},${a[i*3+1].toFixed(2)},${a[i*3+2].toFixed(2)}) j=${[parts.getX(i), s%32, Math.floor(s/32)%32, Math.floor(s/1024)].map(j=>baked.clip.parts[j]).join("/")} w=${[skin.getY(i),skin.getZ(i),skin.getW(i)%1].map(x=>x.toFixed(2))}`; }).join("  ||  "); }
      }
    }
    if (worstInfo) console.log("  ", worstInfo);
    row.push(`${name.slice(-5)} x${worst.toFixed(2)} ${partName}`);
  }
  if (process.argv.includes("--hist")) console.log("  hist", JSON.stringify(hist));
  if (globalThis.top) { console.log(globalThis.top.sort((a, b) => b[0] - a[0]).slice(0, 14).map(t => t[0].toFixed(2) + " " + t[1]).join("\n")); globalThis.top = []; }
  console.log(key.split(':')[0].padEnd(24), row.join(' | '));
  g.dispose();
}
