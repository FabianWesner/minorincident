// Adapted from Bruno Simon's ResourcesLoader (MIT): loaders + promise cache.
import { Box3, Group, Mesh, Vector3, type Object3D, type WebGPURenderer } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from './manifest.json';
import { atLeast, variantPath, type AssetDef, type AssetQuality } from './types';
import { placeholder } from './placeholders';
import { AssetMaterials } from './materials';

export type PlaceholderLog = { type: 'asset.placeholder'; id: string; reason: string };
type Loader = (url: string) => Promise<Object3D>;
/** LOD selection is based on projected height; callers update only when the tier changes. */
export function lodForScreenHeight(pixels: number): 'lod0' | 'lod1' | 'lod2' { return pixels >= 160 ? 'lod0' : pixels >= 40 ? 'lod1' : 'lod2'; }
export class AssetRegistry {
  private readonly definitions: Map<string, AssetDef>;
  private readonly cache = new Map<string, Promise<Object3D>>();
  private readonly materials = new AssetMaterials();
  private readonly ktx?: KTX2Loader;
  private readonly load: Loader;
  constructor(private readonly log: (event: PlaceholderLog) => void, options: { manifest?: AssetDef[]; load?: Loader; renderer?: WebGPURenderer } = {}) {
    this.definitions = new Map((options.manifest ?? manifest as AssetDef[]).map((a) => [a.id, a]));
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    if (options.renderer) {
      this.ktx = new KTX2Loader().setTranscoderPath('/assets/basis/').detectSupport(options.renderer);
      gltf.setKTX2Loader(this.ktx);
    }
    this.load = options.load ?? (async (url) => {
      const parsed = await gltf.loadAsync(url);
      // GLTFLoader sanitizes ':' and '.' for animation binding; restore contract IDs.
      parsed.scene.traverse((node) => {
        const index = parsed.parser.associations.get(node)?.nodes;
        if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name;
      });
      return parsed.scene;
    });
  }
  definition(id: string): AssetDef { const def = this.definitions.get(id); if (!def) throw new Error(`Unknown asset ID ${id}`); return def; }
  async loadAsset(id: string, quality: AssetQuality = 'high', decay?: string): Promise<Object3D> {
    const def = this.definition(id), requested = quality === 'high' ? 'lod0' : quality === 'low' ? 'lod1' : quality;
    const lod = requested !== 'lod0' && !def.lods?.[requested] ? 'lod0' : requested;
    if (decay && !def.decayVariants.includes(decay)) throw new Error(`Unknown decay variant ${id}:${decay}`);
    const key = `${id}:${quality === 'low' && def.lowGlb ? 'low' : lod}:${decay ?? ''}`;
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.prototype(def, lod, decay, quality === 'low' ? def.lowGlb : undefined); this.cache.set(key, pending);
    }
    return (await pending).clone(true);
  }
  private async prototype(def: AssetDef, lod: 'lod0' | 'lod1' | 'lod2', decay?: string, lowGlb?: string): Promise<Object3D> {
    const fallback = (reason: string): Group => { this.log({ type: 'asset.placeholder', id: def.id, reason }); return placeholder(def); };
    if (!atLeast(def.status, 'integrated')) return fallback(`status ${def.status}`);
    const path = lowGlb ?? (lod === 'lod0' ? def.glb : def.lods?.[lod] ?? def.glb);
    if (!path) return fallback(`missing ${lod}`);
    let root: Object3D | undefined;
    try {
      root = await this.load('/' + variantPath(path,decay).replace(/^public\//, ''));
      for (const name of [...def.requiredNodes, ...def.animatedNodes, ...def.sockets]) if (!root.getObjectByName(name)) throw new Error(`missing node ${name}`);
      root.traverse((node) => { if (node.name.startsWith('stump_') || node.userData.hidden) node.visible = false; });
      if (lod !== 'lod0' && def.lods?.[lod]) {
        const bounds = new Box3().setFromObject(root), size = bounds.getSize(new Vector3());
        if (bounds.isEmpty() || ['x', 'y', 'z'].some(axis => Math.abs(size[axis as 'x' | 'y' | 'z'] / def.dimensions[axis as 'x' | 'y' | 'z'] - 1) > def.dimensions.tolerance)) {
          // A malformed LOD must not stretch a building beyond its authored lot.
          root.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
          console.info(JSON.stringify({ type: 'asset.lod-fallback', id: def.id, lod, reason: 'dimensions' }));
          return this.loadAsset(def.id, lod === 'lod2' ? 'lod1' : 'lod0', decay);
        }
      }
      this.materials.swap(root);
      return root;
    } catch (error) {
      root?.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
      if (lod !== 'lod0') {
        console.info(JSON.stringify({ type: 'asset.lod-fallback', id: def.id, lod, reason: String(error) }));
        return this.loadAsset(def.id, lod === 'lod2' ? 'lod1' : 'lod0', decay);
      }
      return fallback(String(error));
    }
  }
  async dispose(): Promise<void> {
    const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<import('three').Material>();
    for (const pending of this.cache.values()) (await pending).traverse((node) => {
      const mesh = node as import('three').Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    this.cache.clear(); this.materials.dispose(); this.ktx?.dispose();
  }
}
