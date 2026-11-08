/** Check regenerated bakes: geometry/material attributes stay exact; only lighting attributes may differ. */
import { deepStrictEqual, equal } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const baseline = process.env.E25_BEFORE_REF ?? 'ac0a9e26';
const old = JSON.parse(execFileSync('git', ['show', `${baseline}:src/assets/staticBakes.json`], { encoding: 'utf8' })) as Record<string, string>;
const next = JSON.parse(readFileSync('src/assets/staticBakes.json', 'utf8')) as Record<string, string>;
type Attribute = { name: string; type: string; length: number; size: number; stride?: number; offset?: number; shared?: string };
function decode(path: string) {
  const b = gunzipSync(readFileSync(`public${path}`)), length = b.readUInt32LE(0), header = JSON.parse(b.subarray(4, 4 + length).toString());
  let offset = 4 + Math.ceil(length / 4) * 4;
  const parts = header.parts.map((part: { attributes: Attribute[] }) => {
    const arrays = new Map<string, number[]>(), attrs: Record<string, string> = {};
    for (const a of part.attributes) {
      const size = a.type === 'short' ? 2 : 4, raw = a.shared ? arrays.get(a.shared)! : Array.from({ length: a.length }, (_, i) => a.type === 'float' ? b.readFloatLE(offset + i * size) : size === 2 ? b.readUInt16LE(offset + i * size) : b.readUInt32LE(offset + i * size));
      if (!a.shared) { arrays.set(a.name, raw); offset += Math.ceil(a.length * size / 4) * 4; }
      const values = a.stride ? Array.from({ length: raw.length / a.stride }, (_, i) => raw.slice(i * a.stride! + (a.offset ?? 0), i * a.stride! + (a.offset ?? 0) + a.size)).flat() : raw;
      attrs[a.name] = createHash('sha256').update(JSON.stringify(values)).digest('hex');
    }
    const metadata = { ...part, attributes: undefined };
    return { metadata, attrs };
  });
  equal(offset, b.length, path);
  return parts;
}
const rows = [];
deepStrictEqual(Object.keys(old).sort(), Object.keys(next).sort(), 'original bake-key set');
for (const [key, path] of Object.entries(next)) {
  if (old[key] === path) continue;
  if (!old[key]) { rows.push({ key, before: null, after: path, added: true }); continue; }
  const a = decode(old[key]), b = decode(path); equal(a.length, b.length, `${key}: part count`);
  const changed: string[] = [];
  for (let i = 0; i < a.length; i++) {
    deepStrictEqual(a[i].metadata, b[i].metadata, `${key}: part metadata`);
    const lighting = new Set(['_light', '_window', '_windowUV']);
    deepStrictEqual(Object.keys(a[i].attrs).filter(n => !lighting.has(n)).sort(), Object.keys(b[i].attrs).filter(n => !lighting.has(n)).sort(), `${key}: nonlighting attribute set`);
    for (const attribute of new Set([...Object.keys(a[i].attrs), ...Object.keys(b[i].attrs)])) if (a[i].attrs[attribute] !== b[i].attrs[attribute]) {
      if (!lighting.has(attribute)) throw Error(`${key}: changed ${attribute}`);
      changed.push(attribute);
    }
  }
  rows.push({ key, before: old[key], after: path, onlyLightingAttributesChanged: true, changed: [...new Set(changed)] });
}
for (const key of Object.keys(old)) equal(!!next[key], true, `${key}: bake removed`);
writeFileSync('docs/reports/e25-emitters/evidence/static-bake-integrity.json', JSON.stringify({ baseline, changed: rows.length, failures: 0, rows }, null, 2) + '\n');
console.log({ changed: rows.length, onlyLightingAttributesChanged: true, failures: 0 });
