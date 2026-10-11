import { Box3, Mesh, MeshBasicMaterial, Vector3, type Group, type Material } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from './manifest.json';
import { atLeast, type AssetDef } from './types';
import { palette, type PaletteToken } from '../data/palette';

const definitions = new Map((manifest as AssetDef[]).map(def => [def.id, def]));
/** Crowd baking reads only names, swatches, sides and vertex colors. Workers
 * need no renderer, lighting graph, palette texture or node materials. */
export async function loadCivilianSource(id: string, requested: 'lod0' | 'lod1' | 'lod2', read: (url: string) => Promise<ArrayBuffer> = async url => {
  const response = await fetch(url); if (!response.ok) throw Error(`Civilian source ${response.status}`); return response.arrayBuffer();
}): Promise<Group> {
  const def = definitions.get(id);
  if (!def || !id.startsWith('npc.') || !atLeast(def.status, 'integrated')) throw Error(`Unavailable civilian ${id}`);
  const lod = requested !== 'lod0' && !def.lods?.[requested] ? 'lod0' : requested;
  let root: Group | undefined;
  try {
    const path = lod === 'lod0' ? def.glb : def.lods![lod]!;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const parsed = await loader.parseAsync(await read('/' + path.replace(/^public\//, '')), ''); root = parsed.scene;
    root.traverse(node => {
      const index = parsed.parser.associations.get(node)?.nodes;
      if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name;
    });
    for (const name of [...def.requiredNodes, ...def.animatedNodes, ...def.sockets]) if (!root.getObjectByName(name)) throw Error(`Missing civilian node ${name}`);
    root.traverse(node => { if (node.name.startsWith('stump_') || node.userData.hidden) node.visible = false; });
    if (lod !== 'lod0') {
      const bounds = new Box3().setFromObject(root), size = bounds.getSize(new Vector3());
      if (bounds.isEmpty() || (['x', 'y', 'z'] as const).some(axis => Math.abs(size[axis] / def.dimensions[axis] - 1) > def.dimensions.tolerance)) throw Error('Civilian LOD dimensions');
    }
    root.userData.assetId = id;
    root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const replace = (source: Material): Material => {
        const match = source.name.match(/^(pal|emi)_(.+)$/), original = source as Material & { color?: import('three').Color };
        if (!original.color) return source;
        const token = match && Object.hasOwn(palette, match[2]) ? match[2] as PaletteToken : undefined;
        const material = new MeshBasicMaterial({ color: token ? palette[token] : original.color, side: source.side, vertexColors: !!token && match![1] !== 'emi' && node.geometry.hasAttribute('color') });
        material.name = token ? source.name : `${source.name}:${source.opacity}:${source.side}`;
        source.dispose(); return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(replace) : replace(node.material);
    });
    return root;
  } catch (error) {
    if (root) disposeCivilianSource(root);
    if (lod !== 'lod0') return loadCivilianSource(id, lod === 'lod2' ? 'lod1' : 'lod0', read);
    throw error;
  }
}
export function disposeCivilianSource(root: Group): void {
  root.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
}
