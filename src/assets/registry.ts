// Adapted from Bruno Simon's ResourcesLoader (MIT): loaders + promise cache.
import { Box3, Group, Mesh, MeshBasicNodeMaterial, PlaneGeometry, SRGBColorSpace, TextureLoader, Vector3, type Object3D, type WebGPURenderer } from 'three/webgpu';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from './manifest.json' with { type: 'json' };
import { atLeast, variantPath, type AssetDef, type AssetQuality } from './types';
import { placeholder } from './placeholders';
import type { Materials } from '../render/Materials';
import { AssetMaterials } from './materials';
import { loadGltf } from './loadGate';
import { applyVehicleDecay, vehicleDecayFallback } from './vehicleDecay';

export type PlaceholderLog = { type: 'asset.placeholder'; id: string; reason: string };
type Loader = (url: string) => Promise<Object3D>;
/** LOD selection is based on projected height; callers update only when the tier changes. */
export function lodForScreenHeight(pixels: number): 'lod0' | 'lod1' | 'lod2' { return pixels >= 160 ? 'lod0' : pixels >= 40 ? 'lod1' : 'lod2'; }
export class AssetRegistry {
  private readonly definitions: Map<string, AssetDef>;
  private readonly cache = new Map<string, Promise<Object3D>>();
  private readonly materials: AssetMaterials;
  private readonly figureTextures = new Set<import('three').Texture>();
  private textureTier: 'high' | 'low' = 'high';
  private readonly atlasReady = new WeakMap<import('three').Texture, Promise<void>>();
  private readonly decalTextures = new Set<import('three').Texture>();
  private readonly ktx?: KTX2Loader;
  private readonly load: Loader;
  private readonly textureSize: 512 | 1024;
  constructor(private readonly log: (event: PlaceholderLog) => void, options: { manifest?: AssetDef[]; load?: Loader; renderer?: WebGPURenderer; materials?: Materials; textureSize?: 512 | 1024 } = {}) {
    this.materials = new AssetMaterials(options.materials);
    this.textureSize = options.textureSize ?? 1024;
    this.textureTier = this.textureSize === 512 ? 'low' : 'high';
    this.definitions = new Map((options.manifest ?? manifest as AssetDef[]).map((a) => [a.id, a]));
    const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const renderer = options.renderer ?? options.materials?.renderer;
    if (renderer) {
      this.ktx = new KTX2Loader().setTranscoderPath('/assets/basis/').detectSupport(renderer);
      gltf.setKTX2Loader(this.ktx);
    }
    this.load = options.load ?? (async (url) => {
      const parsed = await loadGltf(gltf, url);
      // GLTFLoader sanitizes ':' and '.' for animation binding; restore contract IDs.
      parsed.scene.traverse((node) => {
        const index = parsed.parser.associations.get(node)?.nodes;
        if (index !== undefined) node.name = parsed.parser.json.nodes[index].name ?? node.name;
      });
      parsed.scene.animations = parsed.animations;
      return parsed.scene;
    });
  }
  definition(id: string): AssetDef { const def = this.definitions.get(id); if (!def) throw new Error(`Unknown asset ID ${id}`); return def; }
  /** Permanent bodies have an independent mesh budget and retain the original rig. */
  async loadCorpse(id: string, decay?: string): Promise<Object3D> {
    const def = this.definition(id);
    if (!def.corpseGlb) throw new Error(`Missing corpse mesh ${id}`);
    const key = `${id}:corpse:${decay ?? ''}`;
    let pending = this.cache.get(key);
    if (!pending) { pending = this.prototype(def, 'lod0', decay, def.corpseGlb); this.cache.set(key, pending); }
    const prototype = await pending; return def.crowdSkin ? cloneSkeleton(prototype) : prototype.clone(true);
  }
  async loadAsset(id: string, quality: AssetQuality = 'high', decay?: string): Promise<Object3D> {
    const def = this.definition(id); id = def.id;
    // Abilities and UI entries deliberately have no geometry or placeholder.
    if (def.nonModel) { const root = new Group(); root.name = id; root.userData.assetId = id; return root; }
    const requested = quality === 'high' ? 'lod0' : quality === 'low' ? 'lod1' : quality;
    const lod = requested !== 'lod0' && !def.lods?.[requested] ? 'lod0' : requested;
    if (decay && !def.decayVariants.includes(decay) && !vehicleDecayFallback(def, decay)) throw new Error(`Unknown decay variant ${id}:${decay}`);
    const key = `${id}:${quality === 'low' && def.lowGlb ? 'low' : lod}:${decay ?? ''}`;
    let pending = this.cache.get(key);
    if (!pending) {
      pending = this.prototype(def, lod, decay, quality === 'low' ? def.lowGlb : undefined); this.cache.set(key, pending);
    }
    const prototype = await pending; return def.crowdSkin ? cloneSkeleton(prototype) : prototype.clone(true);
  }
  private async prototype(def: AssetDef, lod: 'lod0' | 'lod1' | 'lod2', decay?: string, lowGlb?: string): Promise<Object3D> {
    const fallback = (reason: string): Group => {
      this.log({ type: 'asset.placeholder', id: def.id, reason });
      console.warn(`[assets] ${def.id}${decay ? ':' + decay : ''} fell back to a PLACEHOLDER BOX (${reason}). Never ship this.`);
      return placeholder(def);
    };
    if (!atLeast(def.status, 'integrated')) return fallback(`status ${def.status}`);
    if (def.decalTexture) {
      try {
        const texture = await new TextureLoader().loadAsync('/' + def.decalTexture.replace(/^public\//, ''));
        texture.colorSpace = SRGBColorSpace; this.decalTextures.add(texture);
        const material = new MeshBasicNodeMaterial({ map: texture, transparent: true, depthWrite: false });
        const geometry = new PlaneGeometry(def.dimensions.x, def.dimensions.z); geometry.rotateX(-Math.PI / 2);
        const mesh = new Mesh(geometry, material); mesh.name = 'root'; mesh.position.y = .015;
        const root = new Group(); root.add(mesh); return root;
      } catch (error) { return fallback(String(error)); }
    }
    const highPath = lowGlb ?? (lod === 'lod0' ? def.glb : def.lods?.[lod] ?? def.glb);
    const path = def.textureMode && !def.textureAtlasLow && this.textureSize === 512 ? highPath.replace(/\.glb$/, '.low.glb') : highPath;
    if (!path) return fallback(`missing ${lod}`);
    let root: Object3D | undefined;
    try {
      root = await this.load('/' + variantPath(path, vehicleDecayFallback(def, decay) ? undefined : decay).replace(/^public\//, ''));
      const contract = { ...def, ...(decay ? def.decayNodes?.[decay] : undefined) };
      // Decorative decay variants are never driven or boarded: seat/exit sockets are only required of the intact model.
      for (const name of [...contract.requiredNodes, ...contract.animatedNodes, ...(decay ? [] : contract.sockets)]) if (!root.getObjectByName(name)) throw new Error(`missing node ${name}`);
      root.traverse((node) => { if (node.name.startsWith('stump_') || node.userData.hidden) node.visible = false; });
      if (lod !== 'lod0' && def.lods?.[lod]) {
        const bounds = new Box3().setFromObject(def.crowdSkin && def.id !== 'char.corgi' ? root.getObjectByName('skin_body') ?? root : root), size = bounds.getSize(new Vector3());
        const dimensions = decay ? { ...def.dimensions, ...def.decayDimensions } : def.dimensions;
        if (bounds.isEmpty() || ['x', 'y', 'z'].some(axis => Math.abs(size[axis as 'x' | 'y' | 'z'] / dimensions[axis as 'x' | 'y' | 'z'] - 1) > dimensions.tolerance)) {
          // A malformed LOD must not stretch a building beyond its authored lot.
          root.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
          console.info(JSON.stringify({ type: 'asset.lod-fallback', id: def.id, lod, reason: 'dimensions' }));
          return this.loadAsset(def.id, lod === 'lod2' ? 'lod1' : 'lod0', decay);
        }
      }
      root.userData.assetId = def.id;
      root.userData.assetTextureMode = def.textureMode;
      if (def.textureMode) {
        const maps = new Set<import('three').Texture>();
        root.traverse(node => {
          if (!(node instanceof Mesh)) return;
          for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            const map = (material as import('three').MeshStandardMaterial).map;
            // crowd-texture-quality: the oblique game camera minifies faces along one axis; isotropic mips smeared them.
            if (map) { map.anisotropy = Math.max(map.anisotropy, 8); this.figureTextures.add(map); maps.add(map); }
          }
        });
        if (def.textureAtlasLow) await Promise.all([...maps].map(map => this.prepareAtlasTiers(map, def)));
      }
      root.userData.diner = def.id === 'bld.joes-diner';
      root.userData.paletteWorld = !def.textureMode && !/^(char|npc|inf)\./.test(def.id); root.userData.paletteHydrant = def.id === 'prop.fire-hydrant';
      if (vehicleDecayFallback(def, decay)) applyVehicleDecay(root, decay!);
      this.materials.swap(root, !def.textureMode && !/^(char|npc|inf)\./.test(def.id), def.id === 'prop.fire-hydrant');
      return root;
    } catch (error) {
      root?.traverse(node => { if (node instanceof Mesh) { node.geometry.dispose(); for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose(); } });
      if (lod !== 'lod0') {
        console.info(JSON.stringify({ type: 'asset.lod-fallback', id: def.id, lod, reason: String(error) }));
        return this.loadAsset(def.id, lod === 'lod2' ? 'lod1' : 'lod0', decay);
      }
      // A broken decay variant of a vehicle must never become a box: reuse the intact shell with the damage tint instead.
      if (decay && def.category === 'vehicle' && !vehicleDecayFallback(def, decay)) {
        console.warn(`[assets] ${def.id}:${decay} failed to load (${String(error)}); using the intact shell with the ${decay} tint. Fix the variant GLB.`);
        return this.prototype({ ...def, decayVariants: def.decayVariants.filter(v => v !== decay) }, lod, decay, lowGlb);
      }
      return fallback(String(error));
    }
  }
  /** Decoded RGBA8 atlas allocation, including generated mip levels (not file bytes). */
  textureMemory(): { count: number; decodedBytes: number } {
    let decodedBytes = 0;
    for (const map of this.figureTextures) {
      const image = map.image as { width?: number; height?: number } | undefined;
      let width = image?.width ?? 0, height = image?.height ?? 0;
      if (!width || !height) continue;
      do {
        decodedBytes += width * height * 4;
        if (!map.generateMipmaps || width === 1 && height === 1) break;
        width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2));
      } while (true);
    }
    return { count: this.figureTextures.size, decodedBytes };
  }
  /** Change the image behind the existing Materials.fromTexture map and cache entry. */
  setTextureTier(tier: 'high' | 'low'): void {
    this.textureTier = tier;
    for (const map of this.figureTextures) {
      const images = map.userData.textureTierImages as Partial<Record<'high' | 'low', { width: number; height: number; close?: () => void }>> | undefined;
      const image = images?.[tier];
      if (image && map.image !== image) { map.image = image; map.needsUpdate = true; }
    }
  }
  private prepareAtlasTiers(map: import('three').Texture, def: AssetDef): Promise<void> {
    const images = map.userData.textureTierImages as Partial<Record<'high' | 'low', { width: number; height: number; close?: () => void }>> | undefined;
    if (images?.high && images.low) return Promise.resolve();
    let pending = this.atlasReady.get(map);
    if (!pending) {
      const image = map.image as { width?: number; height?: number; close?: () => void } | undefined;
      if (!image?.width || !image.height || !def.textureAtlasLow) return Promise.resolve();
      const first = image.width <= 512 ? 'low' : 'high';
      const other = first === 'low' ? 'high' : 'low';
      const url = other === 'low' ? '/' + def.textureAtlasLow.replace(/^public\//, '') : '/' + def.glb!.replace(/^public\//, '').replace(/[^/]+$/, `${def.id}.atlas.webp`);
      pending = new TextureLoader().loadAsync(url).then(alternate => {
        map.userData.textureTierImages = { ...(map.userData.textureTierImages ?? {}), [first]: image, [other]: alternate.image };
        alternate.dispose(); this.setTextureTier(this.textureTier);
      });
      this.atlasReady.set(map, pending);
    }
    return pending;
  }
  async dispose(): Promise<void> {
    const geometries = new Set<import('three').BufferGeometry>(), materials = new Set<import('three').Material>();
    for (const pending of this.cache.values()) (await pending).traverse((node) => {
      const mesh = node as import('three').Mesh;
      if (mesh.geometry) geometries.add(mesh.geometry);
      if (mesh.material) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) if (!material.userData.sharedPalette) material.dispose();
    for (const texture of this.decalTextures) texture.dispose();
    this.decalTextures.clear();
    for (const texture of this.figureTextures) {
      texture.dispose();
      const images = texture.userData.textureTierImages as Partial<Record<'high' | 'low', { close?: () => void }>> | undefined;
      const ownedImages = new Set(Object.values(images ?? {}));
      if (texture.image) ownedImages.add(texture.image as { close?: () => void });
      for (const image of ownedImages) image?.close?.();
      delete texture.userData.textureTierImages;
    }
    this.figureTextures.clear();
    this.cache.clear(); this.materials.dispose(); this.ktx?.dispose();
  }
}
