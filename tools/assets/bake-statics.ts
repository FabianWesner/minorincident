import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { Mesh, Scene } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { DistrictAssets } from '../../src/assets/DistrictAssets';
import { productionIds } from '../../src/assets/productionIds';
import { worldAssets } from '../../src/assets/worldDefinitions';
import { encodeStaticBake } from '../../src/assets/staticBakeData';
import { Lighting } from '../../src/render/Lighting';
import { Materials } from '../../src/render/Materials';
import { atLeast } from '../../src/assets/types';

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
export async function staticSource(url: string) {
  const bytes = readFileSync(`public${url}`), parsed = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  parsed.scene.traverse(node => { const index = parsed.parser.associations.get(node)?.nodes; if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name; });
  return parsed.scene;
}
const directory = 'public/assets/statics'; mkdirSync(directory, { recursive: true });
const selected = new Set(process.argv.slice(2));
const files: Record<string, string> = selected.size ? JSON.parse(readFileSync('src/assets/staticBakes.json', 'utf8')) : {}; let total = 0;
if (selected.size) for (const key of Object.keys(files)) if (selected.has(key.split(':')[0])) delete files[key];
const ids = new Set<string>();
for (const district of ['D-GROVE', 'D-CORRIDOR']) {
  const layout = JSON.parse(readFileSync(`public/assets/layouts/${district}.layout.json`, 'utf8'));
  for (const placement of layout.placements) if (worldAssets[placement.assetId]) ids.add(placement.assetId);
}
for (const id of [...ids].sort()) {
  if (selected.size && !selected.has(id)) continue;
  // Animated gun sockets and the diner's generated canvas sign stay on the source path.
  if (id === 'prop.hmg-nest' || id === 'bld.joes-diner') continue;
  const lighting = new Lighting(new Scene()), materials = new Materials(lighting), registry = new DistrictAssets(materials, undefined, staticSource);
  try {
    const manifest = JSON.parse(readFileSync('src/assets/manifest.json', 'utf8'));
    const def = manifest.find((entry: { id: string }) => entry.id === (productionIds[id] ?? id));
    if (!def || !atLeast(def.status, 'integrated')) continue;
    for (const lod of ['lod1', 'lod2'] as const) {
      const canonical = def.lods?.[lod] ? lod : 'lod0';
      for (const decay of ['', ...def.decayVariants]) {
        const key = `${id}:${canonical}:${decay}`; if (files[key]) continue;
        const root = await registry.asset(id, true, lod, decay || undefined);
        if (root.userData.placeholder || root.children.some(child => !(child instanceof Mesh) || child.children.length)) continue;
        const bytes = gzipSync(encodeStaticBake(root), { level: 9 });
        const name = `${id}.${canonical}.${decay || 'base'}.${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.bin.gz`;
        writeFileSync(`${directory}/${name}`, bytes); files[key] = `/assets/statics/${name}`; total += bytes.length;
      }
    }
  } finally { registry.dispose(); materials.dispose(); lighting.dispose(); }
}
writeFileSync('src/assets/staticBakes.json', JSON.stringify(files, null, 2) + '\n');
console.log(`${Object.keys(files).length} lossless static bakes: ${(total / 1048576).toFixed(2)} MiB gzip`);
