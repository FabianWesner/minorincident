import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { BufferAttribute, BufferGeometry, Color, type Group } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { expect, test } from 'vitest';
import { encodeCivilianBake, decodeCivilianBake, decompressCivilianBake } from '../../../src/assets/civilianBakeData';
import { AssetRegistry } from '../../../src/assets/registry';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';
import { loadCivilianSource, disposeCivilianSource } from '../../../src/assets/civilianSource';
import { CrowdGunAim } from '../../../src/render/characters/GunAim';

test('handles raw gzip and fetch responses already decompressed by Content-Encoding', async () => {
  const bytes = new Uint8Array([8, 0, 0, 0, 1, 2, 3, 4]).buffer;
  expect(await decompressCivilianBake(bytes)).toBe(bytes);
  const zipped = gzipSync(new Uint8Array(bytes));
  const compressed = zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength);
  expect(Buffer.from(await decompressCivilianBake(compressed)).equals(Buffer.from(bytes))).toBe(true);
  await expect(decompressCivilianBake(new Uint8Array([0x1f, 0x8b, 0]).buffer)).rejects.toThrow();
});

test('civilian transfer preserves every geometry/pose byte and display field', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, .12345678, -1, 2, 3, 4]), 3));
  geometry.setAttribute('_shirt', new BufferAttribute(new Float32Array([-.5, 1]), 1)); geometry.setIndex([0, 1, 0]); geometry.userData.crowdLodError = .001234;
  const baked = { geometry, clip: { parts: ['root'], frames: 1, duration: 1, matrices: new Float32Array(16).map((_, i) => i * .134) }, shirtColor: new Color('#e26135'), strideScale: .87, doubleSided: true };
  const bytes = encodeCivilianBake(baked), restored = decodeCivilianBake(bytes.buffer as ArrayBuffer);
  expect(Buffer.from(encodeCivilianBake(restored)).equals(Buffer.from(bytes))).toBe(true);
  expect(restored.doubleSided).toBe(true); expect(restored.strideScale).toBe(.87);
  geometry.dispose(); restored.geometry.dispose();
});
for (const id of ['npc.civilian-man-a', 'npc.civilian-elderly', 'npc.national-guard', 'npc.shelter-survivor.lying']) test(`${id}: worker transfer preserves all poses, geometry, rig transforms and gun aim`, async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), registry = new AssetRegistry(event => { throw new Error(JSON.stringify(event)); }, { load: async url => {
    const bytes = readFileSync(`public${url}`); return (await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')).scene;
  } });
  try {
    const model = await registry.loadAsset(id, 'lod1') as Group; prepareCivilianRig(model, id);
    const original = await prepareCivilianGeometry(model, id, false); original.rig = model;
    const cpu = await loadCivilianSource(id, 'lod1', async url => {
      const data = readFileSync(`public${url}`); return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    }); prepareCivilianRig(cpu, id);
    const prepared = await prepareCivilianGeometry(cpu, id, false); prepared.rig = cpu;
    expect(Buffer.from(encodeCivilianBake(prepared)).equals(Buffer.from(encodeCivilianBake(original)))).toBe(true);
    prepared.geometry.dispose(); disposeCivilianSource(cpu);
    const bytes = encodeCivilianBake(original), restored = decodeCivilianBake(bytes.buffer as ArrayBuffer);
    expect(Buffer.from(encodeCivilianBake(restored)).equals(Buffer.from(bytes))).toBe(true);
    for (const part of original.clip.parts) expect(restored.rig!.getObjectByName(part)!.matrixWorld.elements, part).toEqual(model.getObjectByName(part)!.matrixWorld.elements);
    const a = new Float32Array(original.clip.matrices.slice(0, original.clip.parts.length * 16)), b = a.slice();
    new CrowdGunAim(model, original.clip.parts).apply(a, { x: .8, z: .6 });
    new CrowdGunAim(restored.rig!, restored.clip.parts).apply(b, { x: .8, z: .6 });
    expect(Buffer.from(b.buffer).equals(Buffer.from(a.buffer))).toBe(true);
    original.geometry.dispose(); restored.geometry.dispose();
  } finally { await registry.dispose(); }
}, 120_000);
