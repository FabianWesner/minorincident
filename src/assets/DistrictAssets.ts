import { Group, Mesh, type BufferGeometry, type WebGPURenderer, type Material } from "three/webgpu";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PaletteToken } from "../data/palette";
import { paletteTokens } from "../data/palette";
import type { Materials } from "../render/Materials";
import { PaletteMaterial } from "../render/PaletteMaterial";
import { placeholder } from "./districtPlaceholders";
import { worldAssets } from "./worldDefinitions";
import { AssetRegistry } from "./registry";
import { atLeast } from "./types";
import type { AssetQuality } from './types';
import { dinerSign } from '../render/DinerSign';
import { attribute } from 'three/tsl';
import { staticBatch, staticBatchAsync } from './staticBatch';
import { loadGate, loadGltf } from './loadGate';
// E10's semantic building IDs predate the accepted production inventory.
const productionIds: Record<string, string> = {
  'bld.school': 'bld.school-elementary', 'bld.gym': 'int.gym-cafeteria',
  'bld.supermarket': 'int.supermarket', 'bld.pharmacy': 'int.pharmacy-clinic',
  'bld.hospital': 'bld.hospital-exterior', 'bld.substation': 'bld.power-substation',
};
/** Runtime URLs DistrictView requests for a placement asset (LOD1 and LOD2 prototypes), for HTTP prefetch. */
export function districtAssetUrls(id: string, definition: (id: string) => import('./types').AssetDef): string[] {
  const def = definition(productionIds[id] ?? id);
  if (!atLeast(def.status, 'integrated') || def.decalTexture) return [];
  return [...new Set([def.lods?.lod1 ?? def.glb, def.lods?.lod2 ?? def.glb].filter((path): path is string => Boolean(path)).map(path => '/' + path.replace(/^public\//, '')))];
}
/** Shared presentation cache owns source geometry; per-level instance batches borrow it. */
/** Enterable unique buildings: the roof is batched separately and lifted while the player is inside (DistrictView.updateRoofs). */
export const ROOFED = new Set(['bld.garage-detached', 'bld.courier-depot', 'bld.clinic-annex', 'bld.cafe-corner']);
export class DistrictAssets {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly cache = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly batchMaterials = new Set<Material>();
  private readonly signTextures: import("three/webgpu").Texture[] = [];
  private readonly assets: AssetRegistry;
  private readonly ktx?: KTX2Loader;
  constructor(private readonly materials: Materials, renderer?: WebGPURenderer) {
    this.assets = new AssetRegistry((event) => console.info(JSON.stringify(event)), { renderer, materials });
    if (renderer) {
      this.ktx = new KTX2Loader().setTranscoderPath('/assets/basis/').detectSupport(renderer);
      this.loader.setKTX2Loader(this.ktx);
    }
  }
  private remember(root: Group): Group {
    root.traverse((o) => {
      if (o instanceof Mesh) this.geometries.add(o.geometry);
    });
    return root;
  }
  async glb(url: string, lit = true): Promise<Group> {
    const key = `${url}:${lit}`;
    if (!this.cache.has(key))
      this.cache.set(
        key,
        loadGltf(this.loader, url)
          .then(({ scene }) => {
            scene.traverse((o) => {
              if (!(o instanceof Mesh)) return;
              const remap = (m: Material) => {
                const token = m.name.replace(/^(pal|emi)_/, "") as PaletteToken;
                if (!paletteTokens.includes(token))
                  throw new Error(
                    `Unknown palette material ${m.name} in ${url}`,
                  );
                const emi = m.name.startsWith("emi_");
                m.dispose();
                return this.materials.world(
                  emi && !lit ? "backpackTeal" : token,
                  emi && lit ? 2 : 0,
                ).seeThrough();
              };
              o.material = Array.isArray(o.material)
                ? o.material.map(remap)
                : remap(o.material);
              o.castShadow = true;
              o.receiveShadow = true;
            });
            return this.remember(scene);
          })
          .catch((e) => {
            this.cache.delete(key);
            throw e;
          }),
      );
    return this.cache.get(key)!;
  }
  /** Every static batch of a role (body, lit windows, unlit windows) has the same node graph: one
   * shared material means one node build and cache key for all of them, so later LOD0 swaps reuse
   * the warmed render state (no per-asset shader builds during play). */
  private readonly sharedMaterials = new Map<string, Material>();
  private share(root: Group): void {
    for (const child of root.children) {
      if (!(child instanceof Mesh) || (child.name !== 'window-light' && child.name !== 'static-body')) continue;
      const shared = this.sharedMaterials.get(child.name);
      if (shared) { (child.material as Material).dispose(); child.material = shared; }
      else { this.sharedMaterials.set(child.name, child.material as Material); this.batchMaterials.add(child.material as Material); }
    }
  }
  /** Start download, parse and batching of a placement prototype before its layout GLB arrives. */
  prefetch(id: string, lod: AssetQuality = 'lod1'): void {
    try {
      if (worldAssets[id] && atLeast(this.assets.definition(productionIds[id] ?? id).status, "integrated")) void this.base(id, lod).catch(() => {});
    } catch { /* unknown ids report through asset() */ }
  }
  private canonical(id: string, lod: AssetQuality): AssetQuality {
    const assetDef = this.assets.definition(productionIds[id] ?? id);
    return (lod === 'lod1' || lod === 'lod2') && !assetDef.lods?.[lod] ? 'lod0' : lod;
  }
  /** Powered and unpowered placements share their large diffuse geometry. */
  private base(id: string, lod: AssetQuality): Promise<Group> {
    const def = worldAssets[id], productionId = productionIds[id] ?? id, canonical = this.canonical(id, lod);
    const baseKey = `${id}:batch:${canonical}`;
    if (!this.cache.has(baseKey)) this.cache.set(baseKey, this.assets.loadAsset(productionId, canonical).then(async (asset) => {
      await loadGate.wait();
      if (productionId !== id) {
        const source = this.assets.definition(productionId).dimensions, target = def.dimensions;
        const straight = Math.min(1, target.x / source.x, target.z / source.z), turned = Math.min(1, target.x / source.z, target.z / source.x);
        // Fit legacy footprints while retaining human-sized doors/floors.
        const fit = Math.max(straight, turned); asset.scale.set(fit, 1, fit);
        if (turned > straight) asset.rotation.y = Math.PI / 2;
      }
      // The authored sectional leaves expose a real aperture (not a dark overlay on a closed door).
      if (id === 'bld.fire-station') for (const name of ['door_bay_L', 'door_bay_R']) {
        const leaf = asset.getObjectByName(name);
        if (leaf) leaf.position.y += Number(leaf.userData.travel ?? 3.15);
      }
      // While a level is playable, batching is sliced over frames (one gate slot per slice).
      if (ROOFED.has(id)) asset.userData.splitRoof = true;
      const root = this.remember(loadGate.paced ? await staticBatchAsync(asset, true, this.materials, () => loadGate.wait()) : staticBatch(asset, true, this.materials));
      this.share(root);
      if (id === 'bld.joes-diner') {
        const sign = dinerSign(); root.add(sign.root); this.geometries.add(sign.geometry); this.signTextures.push(sign.texture);
      }
      root.traverse(node => { if (node instanceof Mesh) { this.batchMaterials.add(node.material as Material); if (node.material instanceof PaletteMaterial) node.material.seeThrough(); } });
      return root;
    }));
    return this.cache.get(baseKey)!;
  }
  async asset(id: string, lit = true, lod: AssetQuality = 'lod1'): Promise<Group> {
    const def = worldAssets[id];
    if (!def) throw new Error(`Unknown asset: ${id}`);
    const productionId = productionIds[id] ?? id;
    if (atLeast(this.assets.definition(productionId).status, "integrated")) {
      const canonical = this.canonical(id, lod);
      const key = `${id}:${lit}:${canonical}`;
      const baseKey = `${id}:batch:${canonical}`;
      void this.base(id, lod);
      if (!this.cache.has(key)) this.cache.set(key, this.cache.get(baseKey)!.then(source => {
        if (lit) return source;
        const root = source.clone(true);
        root.traverse(node => {
          if (!(node instanceof Mesh) || node.name !== 'window-light') return;
          let material = this.sharedMaterials.get('window-light:unlit');
          if (!material) {
            material = this.materials.shaded(this.materials.sample(attribute('_palette', 'float')).mul(.08)).seeThrough();
            material.name = 'emi_static-windows'; this.sharedMaterials.set('window-light:unlit', material); this.batchMaterials.add(material);
          }
          node.material = material;
        });
        return root;
      }));
      return this.cache.get(key)!;
    }
    const key = `${id}:${lit}`;
    if (!this.cache.has(key))
      this.cache.set(
        key,
        Promise.resolve(this.remember(placeholder(def, this.materials, lit))),
      );
    return this.cache.get(key)!;
  }
  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    this.geometries.clear();
    for (const material of this.batchMaterials) material.dispose(); this.batchMaterials.clear(); this.sharedMaterials.clear();
    for (const texture of this.signTextures) texture.dispose(); this.signTextures.length = 0;
    this.cache.clear();
    void this.assets.dispose();
    this.ktx?.dispose();
  }
}
