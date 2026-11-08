/** Repair subpixel nurse eye discs in authored and shipped skins; body/rig accessors stay identical. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { assetIO } from './io';
import { skinCrowdBakes } from './skin-crowd-bakes';
import type { AssetDef } from '../../src/assets/types';
const io = await assetIO(), apply = process.argv.includes('--apply');
const files = ['assets/inf.nurse/model.skin.glb', ...['lod0', 'lod1', 'lod2'].flatMap(lod => [`public/assets/models/skinned/inf.nurse.${lod}.glb`, `public/assets/models/skinned/inf.nurse.${lod}.low.glb`])];
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const rows = [];
for (const path of files) {
  const before = readFileSync(path), doc = await io.read(path);
  const eye = doc.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')!.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
  const others = doc.getRoot().listAccessors().filter(a => a !== eye).map(a => ({ accessor: a, hash: sha(new Uint8Array(a.getArray()!.buffer, a.getArray()!.byteOffset, a.getArray()!.byteLength)) }));
  if (eye.getCount() !== 8 || eye.getComponentType() !== 5126) throw Error(`${path}: expected two float eye quads`);
  const positions = eye.getArray()!;
  const radii = [];
  for (let start = 0; start < 8; start += 4) {
    const center = [0, 0, 0];
    for (let i = start; i < start + 4; i++) for (let c = 0; c < 3; c++) center[c] += positions[i * 3 + c] / 4;
    const radius = Math.hypot(...[0, 1, 2].map(c => positions[start * 3 + c] - center[c])) / Math.SQRT2;
    radii.push(radius);
    if (radius >= .0175) continue;
    for (let i = start; i < start + 4; i++) for (let c = 0; c < 3; c++) positions[i * 3 + c] = center[c] + (positions[i * 3 + c] - center[c]) * .018 / radius;
  }
  if (apply) {
    eye.setArray(positions); await io.write(path, doc);
    const check = await io.read(path), accessors = check.getRoot().listAccessors();
    // The writer can reorder accessors. Prove the complete multiset of non-eye payloads is unchanged.
    const expected = others.map(a => a.hash).sort();
    const readEye = check.getRoot().listNodes().find(n => n.getName() === 'skin_eyes')!.getMesh()!.listPrimitives()[0].getAttribute('POSITION')!;
    const actual = accessors.filter(a => a !== readEye).map(a => { const b = a.getArray()!; return sha(new Uint8Array(b.buffer, b.byteOffset, b.byteLength)); }).sort();
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw Error(`${path}: non-eye accessor changed`);
  }
  rows.push({ path, beforeSha256: sha(before), afterSha256: sha(readFileSync(path)), beforeRadiiM: radii, targetRadiusM: .018, nonEyeAccessors: others.length, nonEyeAccessorsUnchanged: apply });
}
if (apply) {
  const def = (JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[]).find(d => d.id === 'inf.nurse')!;
  const bakes = JSON.parse(readFileSync('src/assets/civilianBakes.json', 'utf8')) as Record<string, string>;
  Object.assign(bakes, await skinCrowdBakes(def));
  writeFileSync('src/assets/civilianBakes.json', JSON.stringify(bakes, null, 2) + '\n');
  mkdirSync('docs/reports/e25-final/evidence', { recursive: true });
  writeFileSync('docs/reports/e25-final/evidence/nurse-eye-repair.json', JSON.stringify({ rows }, null, 2) + '\n');
}
console.log(JSON.stringify({ apply, rows }, null, 2));
