import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect, test, vi } from 'vitest';
import { Scene, Mesh } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import files from '../../../src/assets/staticBakes.json';
import { DistrictAssets } from '../../../src/assets/DistrictAssets';
import { encodeStaticBake } from '../../../src/assets/staticBakeData';
import { Lighting } from '../../../src/render/Lighting';
import { Materials } from '../../../src/render/Materials';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function source(url: string) {
  const bytes = readFileSync(`public${url}`), parsed = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  parsed.scene.traverse(node => { const index = parsed.parser.associations.get(node)?.nodes; if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name; });
  return parsed.scene;
}
for (const [key, url] of Object.entries(files)) test(`${key}: shipped static bytes and materials equal runtime source`, async () => {
  const [id, lod, decay] = key.split(':'), lighting = new Lighting(new Scene()), materials = new Materials(lighting);
  const registry = new DistrictAssets(materials, undefined, source), builtRegistry = new DistrictAssets(materials);
  try {
    const root = await registry.asset(id, true, lod as 'lod0' | 'lod1' | 'lod2', decay || undefined);
    expect(root.userData.placeholder).not.toBe(true);
    const bytes = gunzipSync(readFileSync(`public${url}`));
    expect(Buffer.from(encodeStaticBake(root)).equals(bytes)).toBe(true);
    vi.stubGlobal('fetch', async () => new Response(bytes));
    const decoded = await builtRegistry.asset(id, true, lod as 'lod0' | 'lod1' | 'lod2', decay || undefined);
    try {
      expect(Buffer.from(encodeStaticBake(decoded)).equals(bytes)).toBe(true);
      for (let i = 0; i < root.children.length; i++) {
        const a = root.children[i] as Mesh, b = decoded.children[i] as Mesh;
        expect(b.material).toMatchObject({ name: (a.material as typeof b.material & { name: string }).name, userData: (a.material as typeof b.material & { userData: object }).userData });
        expect(b.geometry.index?.array.constructor).toBe(a.geometry.index?.array.constructor);
      }
    } finally { builtRegistry.dispose(); vi.unstubAllGlobals(); }
  } finally { registry.dispose(); materials.dispose(); lighting.dispose(); }
}, 30_000);
