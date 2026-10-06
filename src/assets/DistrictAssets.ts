import { Group, Mesh, type BufferGeometry, type Material, type WebGPURenderer } from "three/webgpu";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PaletteToken } from "../data/palette";
import { paletteTokens } from "../data/palette";
import type { Materials } from "../render/Materials";
import { placeholder } from "./districtPlaceholders";
import { worldAssets } from "./worldDefinitions";
import { AssetRegistry } from "./registry";
import { atLeast } from "./types";
/** Shared presentation cache owns source geometry; per-level instance batches borrow it. */
export class DistrictAssets {
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  private readonly cache = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  private readonly assets: AssetRegistry;
  private readonly ktx?: KTX2Loader;
  constructor(private readonly materials: Materials, renderer?: WebGPURenderer) {
    this.assets = new AssetRegistry((event) => console.info(JSON.stringify(event)), { renderer });
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
  async asset(id: string, lit = true): Promise<Group> {
    const def = worldAssets[id];
    if (!def) throw new Error(`Unknown asset: ${id}`);
    if (atLeast(def.status, "integrated")) {
      const key = `${id}:${lit}`;
      if (!this.cache.has(key)) this.cache.set(key, this.assets.loadAsset(id).then((asset) => {
        const root = new Group(); root.add(asset); return root;
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
    this.cache.clear();
    void this.assets.dispose();
    this.ktx?.dispose();
  }
}
