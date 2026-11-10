/** r32-alphas: check the shipped Alpha bakes (frame count = alphaCrowdClips x 24) and print part positions per move phase.
 * node --import tsx/esm tools/qa/r32/check-bake.ts [look] [clip] [parts,comma] */
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { Matrix4, Vector3 } from 'three';
import files from '../../../src/assets/civilianBakes.json';
import { decodeCivilianBake } from '../../../src/assets/civilianBakeData';
import { alphaCrowdClips, framesPerClip } from '../../../src/render/characters/crowdClipNames';
const load = (key: string) => { const bytes = gunzipSync(readFileSync(`public${(files as Record<string, string>)[key]}`)); return decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)).clip; };
for (const key of Object.keys(files)) if (key.startsWith('inf.alpha')) { const clip = load(key); console.log(key, clip.frames, clip.frames === alphaCrowdClips.length * framesPerClip ? 'ok' : 'MISMATCH'); }
const clip = load(`${process.argv[2] ?? 'inf.alpha'}:lod0:infected`), name = process.argv[3] ?? 'alpha-strike', parts = (process.argv[4] ?? 'hip,head,handR,handL,footL,footR').split(',');
const P = clip.parts.length;
for (let f = 0; f < framesPerClip; f += 2) {
  const row = alphaCrowdClips.indexOf(name as typeof alphaCrowdClips[number]) * framesPerClip + f;
  console.log((f / (framesPerClip - 1)).toFixed(2), parts.map(part => { const p = new Vector3().setFromMatrixPosition(new Matrix4().fromArray(clip.matrices, (row * P + clip.parts.indexOf(part)) * 16)); return `${part} ${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`; }).join(' | '));
}
