import { Group, Mesh, type BufferGeometry, type Material } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { PaletteToken } from "../data/palette";
import { paletteTokens } from "../data/palette";
import type { Materials } from "../render/Materials";
import { placeholder } from "./placeholders";
import manifest from "./manifest.json";
/** Shared presentation cache owns source geometry; per-level instance batches borrow it. */
export class AssetRegistry {
  private readonly loader = new GLTFLoader();
  private readonly cache = new Map<string, Promise<Group>>();
  private readonly geometries = new Set<BufferGeometry>();
  constructor(private readonly materials: Materials) {}
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
    const def = manifest[id as keyof typeof manifest];
    if (!def) throw new Error(`Unknown asset: ${id}`);
    // Only integrated/final assets may replace a code placeholder. All current E10 entries are placeholders.
    if (["integrated", "final"].includes(def.status))
      return this.glb(def.glb, lit);
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
  }
}
