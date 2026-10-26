import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from '../../../src/assets/manifest.json';
import bakes from '../../../src/assets/civilianBakes.json';
import { stripGlbTextures } from '../helpers/stripGlbTextures';
import { decodeCivilianBake } from '../../../src/assets/civilianBakeData';
import { prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';

const figures = ['npc.civilian-elderly', 'npc.depot-clerk', 'npc.lab-tech-a', 'npc.lab-tech-b', 'npc.lab-guard', 'npc.firefighter-alive'];
for (const id of figures) for (const lod of ['lod0', 'lod1', 'lod2'] as const) test(`${id}/${lod}: production bake retains its authored atlas coordinates @E17`, async () => {
  const def = manifest.find(d => d.id === id)!, path = lod === 'lod0' ? def.glb : def.lods![lod]!;
  const root = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(stripGlbTextures(readFileSync(path)), '')).scene;
  prepareCivilianRig(root, id); root.updateMatrixWorld(true);
  const source = new Set<string>(), point = new Vector3();
  const key = (p: Vector3, u: number, v: number) => [...p.toArray(), u, v].map(x => Math.round(x * 1e4)).join(',');
  root.traverse(node => {
    if (!(node instanceof Mesh) || Array.isArray(node.material) || node.material.name !== 'tex_baseColor') return;
    const p = node.geometry.getAttribute('position'), uv = node.geometry.getAttribute('uv');
    for (let i = 0; i < p.count; i++) source.add(key(point.fromBufferAttribute(p, i).applyMatrix4(node.matrixWorld), uv.getX(i), uv.getY(i)));
  });
  const data = gunzipSync(readFileSync('public' + bakes[`${id}:${lod}` as keyof typeof bakes]));
  const geometry = decodeCivilianBake(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)).geometry;
  const position = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), parts = geometry.getAttribute('_parts');
  let absent = 0, total = 0;
  for (let i = 0; i < position.count; i++) {
    if (parts.getW(i) >= 1024 || parts.getZ(i) > 1.5 || parts.getY(i) === -10) continue; // Retained PROD helmet uses palette colors, without atlas UVs.
    total++;
    if (!source.has(key(point.fromBufferAttribute(position, i), uv.getX(i), uv.getY(i)))) absent++;
  }
  expect(total).toBeGreaterThan(500);
  expect(absent / total).toBeLessThan(.01);
  const tier = Number(lod.slice(-1));
  const receipt = JSON.parse(readFileSync(`docs/reports/l1-all-new/builds/${id}/lod${tier}.json`, 'utf8'));
  // A position-only reduction crosses UV islands. The authored middle tier
  // also supplies far anatomy at a smaller texture size, within its 4k budget.
  expect(receipt.body).toMatch(new RegExp(`assembled-lod${Math.min(tier, 1)}\\.glb$`));
  expect(receipt.bodyTriangleBudget).toBeNull();
  geometry.dispose();
});
