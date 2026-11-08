/** Transfer repaired light attributes while preserving the accepted bake's geometry and appearance. */
import { deepStrictEqual, equal } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { gzipSync, gunzipSync } from 'node:zlib';
const baseline = process.env.E25_BEFORE_REF ?? 'ac0a9e26';
const old = JSON.parse(execFileSync('git', ['show', `${baseline}:src/assets/staticBakes.json`], { encoding: 'utf8' })) as Record<string, string>;
const next = JSON.parse(readFileSync('src/assets/staticBakes.json', 'utf8')) as Record<string, string>;
type Attribute = { name: string; type: string; length: number; size: number; normalized: boolean; stride?: number; offset?: number; shared?: string };
function decode(path: string) {
  const bytes = gunzipSync(readFileSync(`public${path}`)), length = bytes.readUInt32LE(0), header = JSON.parse(bytes.subarray(4, 4 + length).toString());
  let offset = 4 + Math.ceil(length / 4) * 4;
  const parts = header.parts.map((part: { attributes: Attribute[] }) => {
    const buffers = new Map<string, { offset: number; length: number }>();
    const attrs = new Map(part.attributes.map(a => {
      const size = a.type === 'short' ? 2 : 4, data = a.shared ? buffers.get(a.shared)! : { offset, length: a.length };
      if (!a.shared) { buffers.set(a.name, data); offset += Math.ceil(a.length * size / 4) * 4; }
      const index = (i: number) => data.offset + (a.stride ? Math.floor(i / a.size) * a.stride + (a.offset ?? 0) + i % a.size : i) * size;
      return [a.name, { size: a.size, type: a.type, normalized: a.normalized, length: a.stride ? data.length / a.stride * a.size : data.length,
        get: (i: number) => a.type === 'float' ? bytes.readFloatLE(index(i)) : size === 2 ? bytes.readUInt16LE(index(i)) : bytes.readUInt32LE(index(i)),
        set: (i: number, value: number) => { if (a.type === 'float') bytes.writeFloatLE(value, index(i)); else if (size === 2) bytes.writeUInt16LE(value, index(i)); else bytes.writeUInt32LE(value, index(i)); } }] as const;
    }));
    return { metadata: { ...part, attributes: undefined }, attrs };
  });
  equal(offset, bytes.length, path); return { bytes, parts };
}
const lighting = new Set(['_light', '_window', '_windowUV']), appearance = new Set(['color', '_palette', '_surface']);
const rows = [], omitted: { key: string; path: string }[] = [], obsolete: string[] = [];
for (const [key, path] of Object.entries(next)) {
  // A metadata repair does not add unrelated CPU shortcuts merely because a
  // few JSON bytes moved an asset across the bake transfer-size threshold.
  if (!old[key]) { omitted.push({ key, path }); delete next[key]; obsolete.push(path); continue; }
  if (old[key] === path) continue;
  const a = decode(old[key]), b = decode(path); equal(a.parts.length, b.parts.length, key);
  const preserved: { part: number; attribute: string; scalars: number }[] = [];
  for (let i = 0; i < a.parts.length; i++) {
    deepStrictEqual(a.parts[i].metadata, b.parts[i].metadata, `${key}: geometry/pose metadata`);
    const nonlighting = (m: typeof a.parts[number]['attrs']) => [...m.keys()].filter(n => !lighting.has(n)).sort();
    deepStrictEqual(nonlighting(a.parts[i].attrs), nonlighting(b.parts[i].attrs), `${key}: nonlighting attribute set`);
    for (const [name, source] of a.parts[i].attrs) {
      if (lighting.has(name)) continue;
      const target = b.parts[i].attrs.get(name)!;
      deepStrictEqual([source.size, source.type, source.normalized, source.length], [target.size, target.type, target.normalized, target.length], `${key}:${name}`);
      let scalars = 0;
      for (let j = 0; j < source.length; j++) if (source.get(j) !== target.get(j)) {
        if (!appearance.has(name)) throw Error(`${key}: geometry attribute ${name} differs; cannot transfer light metadata`);
        target.set(j, source.get(j)); scalars++;
      }
      if (scalars) preserved.push({ part: i, attribute: name, scalars });
    }
  }
  if (!preserved.length) continue;
  const compressed = gzipSync(b.bytes, { level: 9 }), hash = createHash('sha256').update(compressed).digest('hex').slice(0, 16);
  const output = path.replace(/[a-f0-9]{16}\.bin\.gz$/, `${hash}.bin.gz`); if (output === path) throw Error('Unexpected bake name');
  writeFileSync(`public${output}`, compressed); next[key] = output; obsolete.push(path);
  rows.push({ key, baseline: old[key], fresh: path, output, preserved, geometryUnchanged: true, lightingFromFreshBake: true });
}
writeFileSync('src/assets/staticBakes.json', JSON.stringify(next, null, 2) + '\n');
for (const path of obsolete) if (!Object.values(next).includes(path)) {
  const tracked = (() => { try { execFileSync('git', ['ls-files', '--error-unmatch', `public${path}`], { stdio: 'ignore' }); return true; } catch { return false; } })();
  if (!tracked) unlinkSync(`public${path}`);
}
const out = 'docs/reports/e25-emitters/evidence/static-appearance-preservation.json';
if (rows.length || !existsSync(out)) writeFileSync(out, JSON.stringify({ baseline, method: 'Fresh lighting columns; all original nonlighting attributes retained. Geometry and pose must match before transfer. Fresh standalone attribute/interleave layout retained.', corrected: rows.length, rows }, null, 2) + '\n');
const scope = 'docs/reports/e25-emitters/evidence/static-bake-scope.json';
if (omitted.length || !existsSync(scope)) writeFileSync(scope, JSON.stringify({ baseline, retainedKeys: Object.keys(old).length, omittedNewShortcuts: omitted }, null, 2) + '\n');
console.log({ corrected: rows.length, omittedNewShortcuts: omitted.length, out });
