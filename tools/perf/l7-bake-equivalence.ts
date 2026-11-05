/** Byte equality of synchronous and paced versions of the same complete bake. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };
import { bakeInfected, bakeInfectedAsync } from '../../src/render/characters/bakeInfected';

const hash = (array: ArrayLike<number>) => {
  const data = ArrayBuffer.isView(array) ? array : Float32Array.from(array);
  return createHash('sha256').update(new Uint8Array(data.buffer, data.byteOffset, data.byteLength)).digest('hex');
};
let pauses = 0, clipComponents = 0;
const cases: string[] = [];
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
for (const [name, crawl] of [['inf.common-worker', false], ['inf.crawler', true], ['char.corgi', false]] as const) {
  const def = manifest.find(asset => asset.id === name)!;
  const bytes = readFileSync(def.glb), root = (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  const a = bakeInfected(root.clone(true), [], crawl);
  const b = await bakeInfectedAsync(async () => { pauses++; await Promise.resolve(); }, root.clone(true), [], crawl);
  if (JSON.stringify(a.clip.parts) !== JSON.stringify(b.clip.parts) || hash(a.clip.matrices) !== hash(b.clip.matrices)) throw Error(`Pose differs: ${name}`);
  for (const [attribute, value] of Object.entries(a.geometry.attributes)) {
    const other = b.geometry.getAttribute(attribute);
    if (value.itemSize !== other.itemSize || hash(value.array) !== hash(other.array)) throw Error(`Geometry differs: ${name}/${attribute}`);
  }
  clipComponents += a.clip.matrices.length; cases.push(name); a.geometry.dispose(); b.geometry.dispose();
}
const out = 'test-results/l7-perf/bake-equivalence.json'; mkdirSync('test-results/l7-perf', { recursive: true });
const result = { exact: true, cases, clipComponents, pauses }; writeFileSync(out, JSON.stringify(result, null, 2) + '\n'); console.log(result);
