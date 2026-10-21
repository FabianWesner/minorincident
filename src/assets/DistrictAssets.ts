import { spinNodes } from "../data/spinNodes";
import { Box3, Color, Group, Mesh, Object3D, Vector3, type BufferGeometry, type WebGPURenderer, type Material } from "three/webgpu";
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
import { atLeast, variantPath } from "./types";
import type { AssetQuality } from './types';
import { dinerSign } from '../render/DinerSign';
import { attribute } from 'three/tsl';
import { anchorsFor } from '../data/placedLights';
import { staticBatch, staticBatchAsync } from './staticBatch';
import { buildingDoors } from '../data/buildingDoors';
import { loadGate, loadGltf } from './loadGate';
import { productionIds } from './productionIds';
import staticBakes from './staticBakes.json';
import { decodeStaticBake } from './staticBakeData';
import { decompressCivilianBake } from './civilianBakeData';
import { addHighwayRailJoints } from './highwayRailJoints';
import { openFireStationBays } from './fireStationBays';
import { vehicleDecayFallback } from './vehicleDecay';
import { lodHeightSlack, occluderMinHeight } from '../render/SeeThrough';
/** Props lower than an occluder keep every fragment while the courier see-through hole is open. */
export const isUncutProp = (id: string, drawnHeight = Infinity): boolean => worldAssets[id]?.category === 'prop' && !worldAssets[id].foliage && Math.min(worldAssets[id].dimensions.y, drawnHeight) < occluderMinHeight * lodHeightSlack;
/** Deduplicated runtime URLs for the placement tiers requested by HTTP prefetch. */
export function districtAssetUrls(id: string, definition: (id: string) => import('./types').AssetDef, lods: ('lod1' | 'lod2')[] = ['lod1', 'lod2'], decay?: string): string[] {
  const def = definition(productionIds[id] ?? id);
  if (!atLeast(def.status, 'integrated') || def.decalTexture) return [];
  return [...new Set(lods.map(lod => {
    const canonical = def.lods?.[lod] ? lod : 'lod0';
    const baked = (staticBakes as Record<string, string>)[`${id}:${canonical}:${decay ?? ''}`];
    const path = def.lods?.[lod] ?? def.glb;
    return baked ?? (path ? '/' + variantPath(path, vehicleDecayFallback(def, decay) ? undefined : decay).replace(/^public\//, '') : undefined);
  }).filter((path): path is string => Boolean(path)))];
}
/** Shared presentation cache owns source geometry; per-level instance batches borrow it. */
/** Enterable unique buildings: the roof is batched separately and lifted while the player is inside (DistrictView.updateRoofs). */
export const ROOFED = new Set(['bld.garage-detached', 'bld.courier-depot', 'bld.clinic-annex', 'bld.cafe-corner', 'bld.fire-station', 'bld.pharmacy', 'bld.supermarket', 'bld.gym', 'int.basement-cellar']);
/** QA #50 (L3 supermarket, L5 pharmacy): "the building reads as a black hollow box with a lit rim". Their flat roof deck was authored
 * in the near-black UI token, so from the game camera the deck inside the light parapet cap read as an empty shell. Draw the deck
 * like every other flat roof (asphalt); the GLBs stay unchanged. */
export const DARK_DECK_ROOFS = new Set(['bld.pharmacy', 'bld.supermarket']);
function asphaltRoofDeck(asset: Object3D, materials: Materials): void {
  asset.getObjectByName('roof')?.traverse(node => {
    if (!(node instanceof Mesh)) return;
    const swap = (m: Material) => m.name === 'pal_uiDark' ? materials.world('asphalt', 0, m.vertexColors, m.side, m.userData.surfaceClass ?? 0) : m;
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
}
export class DistrictAssets {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly cache = new Map<string, Promise<Group>>();
  private readonly glbLeases = new Map<string, number>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly batchMaterials = new Set<Material>();
  /** One material per static-batch graph (staticBatchMaterial): identical batches share a node build. */
  private readonly batchMaterialCache = new Map<string, Material>();
  private readonly signTextures: import("three/webgpu").Texture[] = [];
  private readonly assets: AssetRegistry;
  private readonly ktx?: KTX2Loader;
  constructor(private readonly materials: Materials, private readonly renderer?: WebGPURenderer, private readonly sourceLoader?: (url: string) => Promise<Object3D>) {
    this.assets = new AssetRegistry((event) => console.info(JSON.stringify(event)), { renderer, materials, load: sourceLoader });
    if (renderer) {
      this.ktx = new KTX2Loader().setTranscoderPath('/assets/basis/').detectSupport(renderer);
      this.loader.setKTX2Loader(this.ktx);
    }
  }
  private remember(root: Group): Group {
    root.traverse((o) => {
      if (o instanceof Mesh) {
        // World batches sample _palette; their decoded RGB copy is unused.
        // Drop it before instance wrappers borrow the arrays (large L7 bodies
        // otherwise retain another 32 MB apiece). Figure/color graphs keep it.
        // Offline registries preserve the lossless bake format, including RGB.
        if (this.renderer && !Array.isArray(o.material) && o.material.userData.worldPaletteOnly) o.geometry.deleteAttribute('color');
        this.geometries.add(o.geometry);
      }
    });
    return root;
  }
  async glb(url: string, lit = true, terrain = false): Promise<Group> {
    const key = `${url}:${lit}${terrain ? ':terrain' : ''}`;
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
            if (terrain) {
              // Raw InstancedMesh nodes capture a new matrix buffer in their node
              // graph for every cell. Reuse the district's vertex-attribute batch
              // path and shared material so revisits never compile cold shaders.
              const batch = staticBatch(scene, true, this.materials, false, this.batchMaterialCache); this.share(batch);
              scene.traverse(node => { if (node instanceof Mesh) node.geometry.dispose(); });
              return this.remember(batch);
            }
            return this.remember(scene);
          })
          .catch((e) => {
            this.cache.delete(key);
            throw e;
          }),
      );
    return this.cache.get(key)!;
  }
  /** Streamed terrain borrows the existing cache while resident. Last release
   * evicts CPU arrays and GPU buffers, including a load finishing after unload. */
  leaseGlb(url: string): { ready: Promise<Group>; release: () => void } {
    const key = `${url}:true:terrain`;
    this.glbLeases.set(key, (this.glbLeases.get(key) ?? 0) + 1);
    const ready = this.glb(url, true, true), cached = this.cache.get(key);
    let released = false;
    return { ready, release: () => {
      if (released) return; released = true;
      const count = (this.glbLeases.get(key) ?? 1) - 1;
      if (count) { this.glbLeases.set(key, count); return; }
      this.glbLeases.delete(key);
      if (this.cache.get(key) === cached) this.cache.delete(key);
      void ready.then(root => root.traverse(node => {
        if (!(node instanceof Mesh)) return;
        this.geometries.delete(node.geometry); node.geometry.dispose();
      })).catch(() => {});
    } };
  }
  /** Every static batch of a role (body, lit windows, unlit windows) has the same node graph: one
   * shared material means one node build and cache key for all of them, so later LOD0 swaps reuse
   * the warmed render state (no per-asset shader builds during play). */
  private readonly sharedMaterials = new Map<string, Material>();
  private share(root: Group): void {
    for (const child of root.children) {
      // Split roofs use the same feature graphs as bodies/windows. Share them
      // across LODs too, so a streamed roof does not rebuild nodes during play.
      if (!(child instanceof Mesh) || !['window-light', 'static-body', 'roof', 'roof-light'].includes(child.name)) continue;
      // Window/gloss graphs require different vertex inputs; sharing solely by
      // mesh name silently replaced those graphs with the first matte batch.
      const key = `${child.name}:${(child.material as Material).userData.batchFeatures ?? 'legacy'}`;
      const shared = this.sharedMaterials.get(key);
      // A cached batch material can already be the shared one: never dispose a material still in use.
      if (shared) { if (shared !== child.material) (child.material as Material).dispose(); child.material = shared; }
      else { this.sharedMaterials.set(key, child.material as Material); this.batchMaterials.add(child.material as Material); }
      // Batched light-bearing dressing keeps the world's existing player cutaway.
      if (child.material instanceof PaletteMaterial) child.material.seeThrough();
    }
  }
  /** Start download, parse and batching of a placement prototype before its layout GLB arrives. */
  prefetch(id: string, lod: AssetQuality = 'lod1', decay?: string): void {
    try {
      if (worldAssets[id] && atLeast(this.assets.definition(productionIds[id] ?? id).status, "integrated")) void this.base(id, lod, decay).catch(() => {});
    } catch { /* unknown ids report through asset() */ }
  }
  private canonical(id: string, lod: AssetQuality): AssetQuality {
    const assetDef = this.assets.definition(productionIds[id] ?? id);
    return (lod === 'lod1' || lod === 'lod2') && !assetDef.lods?.[lod] ? 'lod0' : lod;
  }
  /** Powered and unpowered placements share their large diffuse geometry. */
  private base(id: string, lod: AssetQuality, decay?: string): Promise<Group> {
    const def = worldAssets[id], productionId = productionIds[id] ?? id, canonical = this.canonical(id, lod);
    const baseKey = `${id}:batch:${canonical}:${decay ?? ''}`;
    if (!this.cache.has(baseKey)) this.cache.set(baseKey, (async () => {
      const url = !this.sourceLoader && (staticBakes as Record<string, string>)[`${id}:${canonical}:${decay ?? ''}`];
      if (url) {
        try {
          const response = await fetch(url); if (!response.ok) throw Error(`Static bake ${response.status}`);
          const root = decodeStaticBake(await decompressCivilianBake(await response.arrayBuffer()), this.materials, anchorsFor(id).length > 0, this.batchMaterialCache);
          return this.finishBatch(id, this.remember(root));
        } catch { /* Source loading remains the quality-preserving fallback. */ }
      }
      const asset = await this.assets.loadAsset(productionId, canonical, decay);
      await loadGate.wait();
      if (productionId !== id) {
        const source = this.assets.definition(productionId).dimensions, target = def.dimensions;
        const straight = Math.min(1, target.x / source.x, target.z / source.z), turned = Math.min(1, target.x / source.z, target.z / source.x);
        // Fit legacy footprints while retaining human-sized doors/floors.
        const fit = Math.max(straight, turned); asset.scale.set(fit, 1, fit);
        if (turned > straight) asset.rotation.y = Math.PI / 2;
      }
      openFireStationBays(id, asset);
      // While a level is playable, batching is sliced over frames (one gate slot per slice).
      if (ROOFED.has(id)) asset.userData.splitRoof = true;
      if (DARK_DECK_ROOFS.has(id)) asphaltRoofDeck(asset, this.materials);
      if (id === 'kit.army-checkpoint' || id === 'prop.checkpoint-gate') asset.userData.splitDoors = ['gateArm'];
      const leaves = buildingDoors[id]?.leaves; if (leaves?.length) asset.userData.splitDoors = leaves.map(l => l.node);
      // Keep the Metro shutter independent of its static shell.
      if(id==='int.metro-exit')asset.userData.splitDoors=['exitGate'];
      if (id === 'bld.metro-entrance') asset.userData.splitDoors = ['shutter'];
      if (id === 'kit.market-doors') asset.userData.splitDoors = ['marketLeafL', 'marketLeafR'];
      if (spinNodes[id]) asset.userData.splitDoors = spinNodes[id].map(s => s.node);
      // Preserve the HMG's authored barrel frame and socket through static batching.
      const machineGun = id === 'prop.hmg-nest' ? asset.getObjectByName('gun') : undefined;
      const muzzle = machineGun && asset.getObjectByName('muzzle');
      asset.updateWorldMatrix(true,true);
      const muzzleLocal = machineGun && muzzle ? machineGun.worldToLocal(muzzle.getWorldPosition(new Vector3())) : undefined;
      if (machineGun) asset.userData.splitDoors = ['gun'];
      asset.userData.assetId = id;
      // LOD0 can arrive during driving even with an unpaced load gate (Scene Lab
      // and foreground loads). Slice the same batch work instead of blocking a frame.
      const paced = loadGate.paced;
      const pause = () => paced ? loadGate.wait() : new Promise<void>(resolve => setTimeout(resolve, 0));
      const root = this.remember(paced || canonical === 'lod0' ? await staticBatchAsync(asset, true, this.materials, pause, 4, this.batchMaterialCache) : staticBatch(asset, true, this.materials, false, this.batchMaterialCache));
      if (muzzleLocal) {
        const gun = root.children.find(n => n.userData.door === 'gun');
        if (gun) { gun.name = 'gun'; const socket = new Object3D(); socket.name = 'muzzle'; socket.position.copy(muzzleLocal); gun.add(socket); }
      }
      root.userData.placeholder = asset.userData.placeholder === true;
      return this.finishBatch(id, root);
    })());
    return this.cache.get(baseKey)!;
  }
  /** One uncut twin per shared batch material, so every low prop of a role still shares one node build. */
  private readonly uncutMaterials = new Map<Material, PaletteMaterial>();
  private uncut(material: PaletteMaterial): PaletteMaterial {
    let twin = this.uncutMaterials.get(material);
    if (!twin) { twin = material.frozenCopy().seeThrough(false); twin.name = `${material.name}:uncut`; this.uncutMaterials.set(material, twin); this.batchMaterials.add(twin); }
    return twin;
  }
  private finishBatch(id: string, root: Group): Group {
    this.share(root);
    if (id === 'bld.joes-diner') {
      const sign = dinerSign(); root.add(sign.root); this.geometries.add(sign.geometry); this.signTextures.push(sign.texture);
    }
    // Furniture lower than an occluder (benches, hydrants, beds, low fences) is never cut by the courier hole: it cannot hide her,
    // and the group-sized hole at close zoom otherwise dissolved everything above 0.3 m (PO 10-13 bench without planks).
    const solid = isUncutProp(id, new Box3().setFromObject(root).getSize(new Vector3()).y);
    root.traverse(node => { if (node instanceof Mesh) {
      // A shut metro leaf must read as a solid barrier even with the courier behind it.
      if (node.material instanceof PaletteMaterial) {
        if (id === 'bld.metro-entrance' && node.userData.door === 'shutter') node.material = node.material.frozenCopy().seeThrough(false);
        else if (solid) node.material = this.uncut(node.material);
        else node.material.seeThrough();
      }
      this.batchMaterials.add(node.material as Material);
    } });
    if (id === 'kit.highway-onramp') {
      const material = this.uncut(this.materials.fromColor('highway-rail-joint', new Color('#999996'), 0, true));
      for (const geometry of addHighwayRailJoints(root, material)) this.geometries.add(geometry);
    }
    return root;
  }
  /** `decay`: a reviewed decay variant of the asset (`w2`/`w3` buildings, `wrecked` vehicles; E21 per-placement damage). */
  async asset(id: string, lit = true, lod: AssetQuality = 'lod1', decay?: string): Promise<Group> {
    const def = worldAssets[id];
    // Registered decals, camp kits and character dressing have no world footprint.
    // Keep their original materials (including decal alpha/texture) in static instances.
    if (!def) {
      const key = `dressing:${id}:${lod}:${decay ?? ''}`;
      if (!this.cache.has(key)) this.cache.set(key, this.assets.loadAsset(id, lod, decay).then(root => {
        if (anchorsFor(id).length && !/^veh\./.test(id)) { root.userData.assetId = id; const batch = staticBatch(root, true, this.materials, false, this.batchMaterialCache); this.share(batch); return this.remember(batch); }
        const group = new Group(); group.add(root); return this.remember(group);
      }));
      return this.cache.get(key)!;
    }
    const productionId = productionIds[id] ?? id;
    if (atLeast(this.assets.definition(productionId).status, "integrated")) {
      const canonical = this.canonical(id, lod);
      const key = `${id}:${lit}:${canonical}:${decay ?? ''}`;
      const baseKey = `${id}:batch:${canonical}:${decay ?? ''}`;
      void this.base(id, lod, decay);
      if (!this.cache.has(key)) this.cache.set(key, this.cache.get(baseKey)!.then(source => {
        if (lit || (anchorsFor(id).length && !/^veh\./.test(id))) return source;
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
    for (const material of this.batchMaterials) material.dispose(); this.batchMaterials.clear(); this.sharedMaterials.clear(); this.uncutMaterials.clear();
    for (const material of this.batchMaterialCache.values()) material.dispose(); this.batchMaterialCache.clear();
    for (const texture of this.signTextures) texture.dispose(); this.signTextures.length = 0;
    this.cache.clear();
    this.glbLeases.clear();
    void this.assets.dispose();
    this.ktx?.dispose();
  }
}
