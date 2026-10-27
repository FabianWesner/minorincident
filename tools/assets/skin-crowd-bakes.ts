import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { DataTexture, type Group } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import type { AssetDef } from '../../src/assets/types';
import { encodeCivilianBake } from '../../src/assets/civilianBakeData';
import { bakeInfected } from '../../src/render/characters/bakeInfected';
import { prepareCivilianGeometry, prepareCivilianRig } from '../../src/render/npc/prepareCivilianGeometry';
import { AssetRegistry } from '../../src/assets/registry';
import { deinterleaveGeometry } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergeCrowdVertices } from '../../src/render/characters/mergeCrowdVertices';

/** Offline form of the production preparations; textures remain owned by AssetRegistry. */
export async function skinCrowdBakes(def: AssetDef, lods: readonly ('lod0' | 'lod1' | 'lod2')[] = ['lod0', 'lod1', 'lod2']): Promise<Record<string, string>> {
  const files: Record<string, string> = {}, directory = 'public/assets/civilians'; mkdirSync(directory, { recursive: true });
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  loader.register(() => ({ name: 'KHR_texture_basisu', loadTexture: async () => new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1) }));
  const registry = new AssetRegistry(event => { throw Error(JSON.stringify(event)); }, { manifest: [def], load: async url => {
    const data = readFileSync(`public${url}`), parsed = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    parsed.scene.traverse(node => { const index = parsed.parser.associations.get(node)?.nodes; if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name; }); return parsed.scene;
  } });
  try {
  for (const lod of lods) for (const civilian of def.id.startsWith('npc.') ? [false, true] : [false]) {
    const root = await registry.loadAsset(def.id, lod) as Group;
    if (civilian) prepareCivilianRig(root, def.id);
    const baked = civilian ? await prepareCivilianGeometry(root, def.id, lod === 'lod2') : bakeInfected(root, def.animatedNodes, def.id === 'inf.crawler', undefined, undefined, true, true);
    if (!civilian) { deinterleaveGeometry(baked.geometry); const merged = mergeCrowdVertices(baked.geometry); baked.geometry.dispose(); baked.geometry = merged; }
    const bytes = gzipSync(encodeCivilianBake({ ...baked, rig: root }), { level: 9 });
    const name = `${def.id}.${lod}${civilian ? '' : '.infected'}.${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.bin.gz`;
    writeFileSync(`${directory}/${name}`, bytes); files[`${def.id}:${lod}${civilian ? '' : ':infected'}`] = `/assets/civilians/${name}`;
    baked.geometry.dispose();
  }
  } finally { await registry.dispose(); }
  return files;
}
