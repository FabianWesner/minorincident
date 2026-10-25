import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test } from 'vitest';
import files from '../../../src/assets/civilianBakes.json';
import { loadCivilianSource, disposeCivilianSource } from '../../../src/assets/civilianSource';
import { encodeCivilianBake, decodeCivilianBake } from '../../../src/assets/civilianBakeData';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../../src/render/npc/prepareCivilianGeometry';
import { DataTexture, type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { AssetRegistry } from '../../../src/assets/registry';
import { bakeInfected } from '../../../src/render/characters/bakeInfected';
import manifest from '../../../src/assets/manifest.json';
import { deinterleaveGeometry } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeCrowdVertices } from '../../../src/render/characters/mergeCrowdVertices';

for (const [key, path] of Object.entries(files)) test(`${key}: shipped bake exactly matches runtime preparation`, async () => {
  const [model, lod] = key.split(':') as [string, 'lod0' | 'lod1' | 'lod2'];
  const read = async (url: string) => {
    const bytes = readFileSync(`public${url}`);
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  };
  const infected = key.endsWith(':infected'), loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({ name: 'KHR_texture_basisu', loadTexture: async () => new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) }));
  const registry = infected ? new AssetRegistry(event => { throw Error(JSON.stringify(event)); }, { load: async url => {
    const parsed = await loader.parseAsync(await read(url), ''); parsed.scene.traverse(node => { const index = parsed.parser.associations.get(node)?.nodes; if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name; }); return parsed.scene;
  } }) : undefined;
  const root = registry ? await registry.loadAsset(model, lod) as Group : await loadCivilianSource(model, lod, read);
  try {
    if (!infected) prepareCivilianRig(root, model);
    const prepared = infected ? { ...bakeInfected(root, manifest.find(d => d.id === model)!.animatedNodes, false, undefined, undefined, true, true), rig: root } : await prepareCivilianGeometry(root, model, lod === 'lod2'); prepared.rig = root;
    if (infected) { deinterleaveGeometry(prepared.geometry); const merged = mergeCrowdVertices(prepared.geometry); prepared.geometry.dispose(); prepared.geometry = merged; }
    const bytes = gunzipSync(readFileSync(`public${path}`));
    expect(bytes.equals(Buffer.from(encodeCivilianBake(prepared)))).toBe(true);
    const decoded = decodeCivilianBake(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    expect(Buffer.from(encodeCivilianBake(decoded)).equals(bytes)).toBe(true);
    decoded.geometry.dispose(); prepared.geometry.dispose();
  } finally { if (registry) await registry.dispose(); else disposeCivilianSource(root); }
}, 120_000);
