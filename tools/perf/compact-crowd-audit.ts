/** Offline exact indexed-attribute comparison; memory/timing acceptance stays in quiet browser runs. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import type { BufferGeometry } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { deinterleaveGeometry, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };
import { regularInfectedModels } from '../../src/data/crowdAppearance';
import { bakeInfected } from '../../src/render/characters/bakeInfected';
import { simplifyCrowdLod } from '../../src/render/characters/crowdLodGeometry';
import { cloneCrowdGeometry } from '../../src/render/characters/cloneCrowdGeometry';
import { compactCrowdGeometry } from '../../src/render/characters/compactCrowdGeometry';

const signature = (g: BufferGeometry) => Object.fromEntries(Object.entries(g.attributes).map(([name, a]) => {
  const values = new Float64Array(g.index!.count * a.itemSize);
  for (let i = 0; i < g.index!.count; i++) for (let c = 0; c < a.itemSize; c++) values[i * a.itemSize + c] = a.getComponent(g.index!.getX(i), c);
  return [name, { size: a.itemSize, normalized: a.normalized, hash: createHash('sha256').update(new Uint8Array(values.buffer)).digest('hex') }];
}));
const bytes = (g: BufferGeometry) => Object.values(g.attributes).reduce((sum, a) => sum + ('data' in a ? a.data.array.byteLength : a.array.byteLength), g.index!.array.byteLength);
const rows: unknown[] = [];
for (const id of [...regularInfectedModels, 'inf.alpha', 'inf.dog', 'inf.crawler']) for (const low of [false, true]) {
  const def = manifest.find(a => a.id === id)!, file = readFileSync(def.lods!.lod2!);
  const { scene } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const baked = bakeInfected(scene, def.animatedNodes, id === 'inf.crawler'); deinterleaveGeometry(baked.geometry);
  const g = mergeVertices(baked.geometry); baked.geometry.dispose();
  await simplifyCrowdLod(g, low ? .025 : .01, low ? .1 : .35, true);
  const before = { bytes: bytes(g), vertices: g.getAttribute('position').count, triangles: g.index!.count / 3, signature: signature(g) };
  compactCrowdGeometry(g);
  const after = { bytes: bytes(g), vertices: g.getAttribute('position').count, triangles: g.index!.count / 3, signature: signature(g) };
  assert.deepEqual(after.signature, before.signature); assert.equal(after.triangles, before.triangles);
  const clone = cloneCrowdGeometry(g);
  assert.deepEqual(signature(clone), after.signature);
  assert.notEqual(clone.index, g.index); assert.equal(clone.index!.array, g.index!.array);
  for (const name of Object.keys(g.attributes)) { assert.notEqual(clone.getAttribute(name), g.getAttribute(name)); assert.equal(clone.getAttribute(name).array, g.getAttribute(name).array); }
  rows.push({ id, tier: low ? 'low' : 'high', before, after, cloneSharedBytes: bytes(clone), cloneSignature: signature(clone) });
  clone.dispose();
  console.log(JSON.stringify({ id, low, bytesSaved: before.bytes - after.bytes })); g.dispose();
}
writeFileSync(process.argv[2], JSON.stringify(rows, null, 2));
