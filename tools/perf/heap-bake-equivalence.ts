/** Offline byte comparison of shipped infected bakes before/after a cache hit.
 * Complements pixel evidence; it does not replace a backend frame comparison.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Mesh, type BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { bakeInfected } from '../../src/render/characters/bakeInfected';

const output = process.argv[2] ?? 'docs/reports/heap-budgets/evidence/bake-equivalence.json';
mkdirSync(dirname(output), { recursive: true });
const hash = (array: ArrayBufferView) => createHash('sha256').update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest('hex');
const geometrySignature = (geometry: BufferGeometry) => Object.fromEntries(Object.entries(geometry.attributes).map(([name, attribute]) => {
  const interleaved = 'data' in attribute;
  return [name, { size: attribute.itemSize, count: attribute.count, normalized: attribute.normalized,
    offset: interleaved ? attribute.offset : 0, stride: interleaved ? attribute.data.stride : attribute.itemSize,
    hash: hash(interleaved ? attribute.data.array : attribute.array) }];
}));
const rows: unknown[] = [];
for (const id of [...regularInfectedModels, 'inf.alpha', 'inf.dog', 'inf.crawler']) for (const lod of ['lod1', 'lod2'] as const) {
  const def = manifest.find(asset => asset.id === id)!;
  const load = async () => {
    const path = def.lods?.[lod]; if (!path) throw Error(`Missing ${id} ${lod}`);
    const bytes = readFileSync(path);
    return (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  };
  const roots = [await load(), await load(), await load()];
  const first = bakeInfected(roots[0], def.animatedNodes, id === 'inf.crawler', undefined, `heap-equivalence:${id}:${lod}`);
  const cached = bakeInfected(roots[1], def.animatedNodes, id === 'inf.crawler', undefined, `heap-equivalence:${id}:${lod}`);
  const fresh = bakeInfected(roots[2], def.animatedNodes, id === 'inf.crawler');
  const signature = (baked: typeof first) => ({ geometry: geometrySignature(baked.geometry), strideScale: baked.strideScale,
    shirtColor: baked.shirtColor?.toArray(), doubleSided: baked.doubleSided, parts: baked.clip.parts, frames: baked.clip.frames,
    matrices: hash(baked.clip.matrices as Float32Array) });
  const a = signature(first), b = signature(cached), c = signature(fresh);
  const differentFields = (other: typeof a) => Object.keys(a).filter(key => JSON.stringify(a[key as keyof typeof a]) !== JSON.stringify(other[key as keyof typeof a]));
  const row = { id, lod, reusedClip: cached.clip === first.clip, cachedDifferences: differentFields(b), freshDifferences: differentFields(c), first: a, cached: b, fresh: c };
  rows.push(row); writeFileSync(output, JSON.stringify(rows, null, 2) + '\n');
  console.log(JSON.stringify({ id, lod, reusedClip: row.reusedClip, cachedDifferences: row.cachedDifferences, freshDifferences: row.freshDifferences }));
  if (!row.reusedClip || row.cachedDifferences.length || row.freshDifferences.length) process.exitCode = 1;
  for (const baked of [first, cached, fresh]) baked.geometry.dispose();
  for (const root of roots) root.traverse(node => { if (node instanceof Mesh) {
    node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose();
  } });
}
