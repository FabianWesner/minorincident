/** Prove the metadata migration kept every original GLB payload/geometry and retained delivery budgets. */
import { deepStrictEqual, equal } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Gltf } from '../assets/lights';
import type { AssetDef } from '../../src/assets/types';
const baseline = process.env.E25_BEFORE_REF ?? 'ac0a9e26';
const manifest = (JSON.parse(readFileSync('src/assets/manifest.json', 'utf8')) as AssetDef[]).filter(d => d.glb).sort((a, b) => b.glb.length - a.glb.length);
type Model = Omit<Gltf, 'meshes'> & { accessors?: { count: number }[]; meshes?: { primitives: { indices?: number; attributes: { POSITION: number } }[] }[] };
const json = (b: Buffer) => JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()) as Model;
const tail = (b: Buffer) => b.subarray(20 + b.readUInt32LE(12));
const triangles = (g: Model) => (g.nodes ?? []).reduce((s, n) => s + (n.mesh === undefined ? 0 : g.meshes![n.mesh].primitives.reduce((s, p) => s + g.accessors![p.indices ?? p.attributes.POSITION].count / 3, 0)), 0);
const paths = execFileSync('git', ['diff', '--name-only', baseline, '--', 'assets', 'public/assets/models'], { encoding: 'utf8' }).trim().split('\n').filter(p => p.endsWith('.glb'));
const rows = [];
for (const path of paths) {
  const before = execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 64 * 1024 * 1024 }), after = readFileSync(path), old = json(before), next = json(after);
  equal(tail(before).equals(tail(after)), true, `${path}: binary payload`);
  const count = old.nodes?.length ?? 0;
  for (const [i, n] of (old.nodes ?? []).entries()) if (n.name) equal(next.nodes![i].name, n.name, `${path}: original name`);
  for (const n of next.nodes?.slice(count) ?? []) equal(n.mesh === undefined && n.name?.startsWith('light:') && !!n.extras?.ss_light, true, `${path}: appended light empty`);
  const normalize = (value: Model) => {
    const copy = structuredClone(value); copy.nodes?.splice(count);
    for (const scene of copy.scenes ?? []) scene.nodes = scene.nodes.filter(i => i < count);
    for (const n of copy.nodes ?? []) {
      delete n.name; if (n.children) n.children = n.children.filter(i => i < count);
      if (n.extras) {
        delete n.extras.decorativeEmissive;
        if (n.extras.ss_light) { const raw = n.extras.ss_light, data = typeof raw === 'string' ? JSON.parse(raw) : structuredClone(raw) as Record<string, unknown>; delete data.emissiveNodes; n.extras.ss_light = data; }
        if (!Object.keys(n.extras).length) delete n.extras;
      }
    }
    return copy;
  };
  deepStrictEqual(normalize(old), normalize(next), `${path}: only emitter names/metadata and light empties`);
  equal(triangles(old), triangles(next), `${path}: triangle count`);
  const def = path.startsWith('public/') ? manifest.find(d => path === d.glb || path.startsWith(d.glb.replace(/\.glb$/, '.'))) : undefined;
  const tierLimit = def ? (def.tier === 'hero' ? 1500 : 300) * 1024 : undefined;
  const lod = Number(/\.lod([12])/.exec(path)?.[1] ?? 0);
  const triangleLimit = def && lod ? def.category === 'vehicle' ? (lod === 1 ? 6000 : 2000) : /^(bld\.house-|bld\.safe-house$|house\.)/.test(def.id) ? (lod === 1 ? 12000 : 4000) : undefined : undefined;
  if (tierLimit !== undefined) equal(after.length <= tierLimit, true, `${path}: ${after.length} > ${tierLimit} bytes`);
  if (triangleLimit !== undefined) equal(triangles(next) <= triangleLimit, true, `${path}: ${triangles(next)} > ${triangleLimit} triangles`);
  rows.push({ path, beforeBytes: before.length, afterBytes: after.length, binaryPayloadIdentical: true, binarySHA256: createHash('sha256').update(tail(after)).digest('hex'), onlyEmitterMetadataChanged: true, triangles: triangles(next), tierLimitBytes: tierLimit ?? null, distanceTriangleLimit: triangleLimit ?? null });
}
writeFileSync('docs/reports/e25-emitters/evidence/integrity-final.json', JSON.stringify({ baseline, files: rows, failures: 0 }, null, 2) + '\n');
console.log({ files: rows.length, binaryPayloadsIdentical: rows.length, failures: 0 });
