import { Group, Mesh, MeshLambertNodeMaterial, type BufferGeometry, type Material } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PaletteToken } from "../data/palette";
import { paletteTokens } from "../data/palette";
import type { Materials } from "../render/Materials";
import { placeholder } from "./districtPlaceholders";
import { worldAssets } from "./worldDefinitions";
import { AssetRegistry } from "./registry";
import { atLeast } from "./types";
import type { AssetQuality } from './types';
import { staticBatch } from './staticBatch';
// E10's semantic building IDs predate the accepted production inventory.
const productionIds: Record<string, string> = {
  'bld.school': 'bld.school-elementary', 'bld.gym': 'int.gym-cafeteria',
  'bld.supermarket': 'int.supermarket', 'bld.pharmacy': 'int.pharmacy-clinic',
  'bld.hospital': 'bld.hospital-exterior', 'bld.substation': 'bld.power-substation',
};
/** Shared presentation cache owns source geometry; per-level instance batches borrow it. */
export class DistrictAssets {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly batchMaterials = new Set<Material>();
  private readonly assets = new AssetRegistry((event) => console.info(JSON.stringify(event)));
  constructor(private readonly materials: Materials, private readonly quality: 'high' | 'low' = 'high') {}
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
        this.loader
          .loadAsync(url)
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
                return this.materials.get(
                  emi && !lit ? "backpackTeal" : token,
                  emi && lit ? 2 : 0,
                );
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
  async asset(id: string, lit = true, lod: AssetQuality = 'lod1'): Promise<Group> {
    const def = worldAssets[id];
    if (!def) throw new Error(`Unknown asset: ${id}`);
    const productionId = productionIds[id] ?? id;
    if (atLeast(this.assets.definition(productionId).status, "integrated")) {
      const assetDef = this.assets.definition(productionId);
      const canonical = (lod === 'lod1' || lod === 'lod2') && !assetDef.lods?.[lod] ? 'lod0' : lod;
      const key = `${id}:${lit}:${canonical}`;
      // Powered and unpowered placements share their large diffuse geometry.
      const baseKey = `${id}:batch:${canonical}`;
      if (!this.cache.has(baseKey)) this.cache.set(baseKey, this.assets.loadAsset(productionId, canonical).then((asset) => {
        if (productionId !== id) {
          const source = this.assets.definition(productionId).dimensions, target = def.dimensions;
          const straight = Math.min(1, target.x / source.x, target.z / source.z), turned = Math.min(1, target.x / source.z, target.z / source.x);
          // Fit legacy footprints while retaining human-sized doors/floors.
          const fit = Math.max(straight, turned); asset.scale.set(fit, 1, fit);
          if (turned > straight) asset.rotation.y = Math.PI / 2;
        }
        const root = this.remember(staticBatch(asset, true));
        root.traverse(node => { if (node instanceof Mesh) this.batchMaterials.add(node.material as Material); });
        return root;
      }));
      if (!this.cache.has(key)) this.cache.set(key, this.cache.get(baseKey)!.then(source => {
        if (lit) return source;
        const root = source.clone(true);
        root.traverse(node => {
          if (!(node instanceof Mesh) || node.name !== 'window-light') return;
          const material = new MeshLambertNodeMaterial({ vertexColors: true });
          material.name = 'emi_static-windows'; material.color.setScalar(.08);
          this.batchMaterials.add(material); node.material = material;
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
    for (const material of this.batchMaterials) material.dispose(); this.batchMaterials.clear();
    this.cache.clear();
    void this.assets.dispose();
  }
}
