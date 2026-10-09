// A distance tier of a small prop must still look like the prop. Small dressing draws LOD2 at the game camera
// (lodPolicy.propLod), so a collapsed tier shows up as loose black spikes and flat triangles next to street signs
// (PO 10-09, L2 start: prop.trash-bags LOD2 was 20 triangles, 1.2 % of LOD0, with a quarter of its surface area).
import { readFileSync } from 'node:fs';
import { Box3, Mesh, Vector3, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import manifest from '../../../src/assets/manifest.json';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function load(url: string): Promise<Object3D> {
  const file = readFileSync(url);
  return (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
}
interface Surface { area: number; triangles: number; box: Box3; points: Float32Array }
/** Area, bounds and an area-weighted deterministic point sample of every triangle in world space. */
function surface(scene: Object3D, samples: number): Surface {
  scene.updateMatrixWorld(true);
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), u = new Vector3(), v = new Vector3(), box = new Box3();
  const triangles: number[][] = [], cumulative: number[] = [];
  let area = 0;
  scene.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const position = node.geometry.getAttribute('position'), index = node.geometry.index, count = index ? index.count : position.count;
    for (let t = 0; t < count; t += 3) {
      for (const [k, target] of [a, b, c].entries()) target.fromBufferAttribute(position, index ? index.getX(t + k) : t + k).applyMatrix4(node.matrixWorld);
      box.expandByPoint(a).expandByPoint(b).expandByPoint(c);
      area += u.subVectors(b, a).cross(v.subVectors(c, a)).length() / 2;
      cumulative.push(area); triangles.push([a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z]);
    }
  });
  const points = new Float32Array(samples * 3);
  let seed = 12345; const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < samples && triangles.length; i++) {
    const target = random() * area; let low = 0, high = cumulative.length - 1;
    while (low < high) { const mid = (low + high) >> 1; if (cumulative[mid] < target) low = mid + 1; else high = mid; }
    const t = triangles[low], s = Math.sqrt(random()), r = random();
    for (let k = 0; k < 3; k++) points[i * 3 + k] = t[k] * (1 - s) + t[3 + k] * s * (1 - r) + t[6 + k] * s * r;
  }
  return { area, triangles: triangles.length, box, points };
}
/** 95th percentile of the nearest-point distance, measured both ways so missing and invented surface both count. */
function p95(a: Float32Array, b: Float32Array): number {
  const worst: number[] = [];
  for (const [from, to] of [[a, b], [b, a]] as const) {
    const distances: number[] = [];
    for (let i = 0; i < from.length; i += 3) {
      let best = Infinity;
      for (let j = 0; j < to.length; j += 3) { const x = from[i] - to[j], y = from[i + 1] - to[j + 1], z = from[i + 2] - to[j + 2]; best = Math.min(best, x * x + y * y + z * z); }
      distances.push(Math.sqrt(best));
    }
    distances.sort((x, y) => x - y); worst.push(distances[Math.floor(distances.length * .95)]);
  }
  return Math.max(...worst);
}
/** Plants are thousands of thin petals: their far tier legitimately keeps a few clusters. */
const exempt = new Set(['prop.flower']);
const small = /^(prop|decay|house)\./;
test('distance tiers of small props keep their surface (no collapsed LOD2 spikes) @load', async () => {
  const failures: string[] = [];
  for (const def of manifest as { id: string; glb: string; lods?: { lod1?: string; lod2?: string } }[]) {
    if (!small.test(def.id) || !def.lods || exempt.has(def.id)) continue;
    const base = surface(await load(def.glb), 500), diagonal = base.box.getSize(new Vector3()).length();
    for (const lod of ['lod1', 'lod2'] as const) {
      const path = def.lods[lod]; if (!path) continue;
      const tier = surface(await load(path), 500);
      const area = tier.area / base.area, distance = p95(base.points, tier.points) / diagonal;
      if (area < .3 || distance > .1) failures.push(`${def.id} ${lod}: ${tier.triangles}/${base.triangles} triangles, surface ${(area * 100).toFixed(0)} %, p95 deviation ${(distance * 100).toFixed(1)} % of its size`);
    }
  }
  expect(failures).toEqual([]);
}, 600_000);
