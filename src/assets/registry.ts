import { Group, Mesh, Vector3, type Material, type MeshStandardMaterial } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import manifest from './manifest.json';
import { actionPlaceholder } from './placeholders';
import type { Materials } from '../render/Materials';
import { paletteTokens, type PaletteToken } from '../data/palette';

const modelUrls = import.meta.glob<string>('../../assets/{wpn.*,thr.*}/model.glb', { eager: true, query: '?url', import: 'default' });
export const iconUrls = import.meta.glob<string>('./icons/*.svg', { eager: true, query: '?url', import: 'default' });
export interface LoadedActionAsset { model: Group; source: 'glb' | 'placeholder'; reason: string | null }
/** Palette-remapped prototypes owned by the level registry. Clones share geometry/materials.
 * Load failure and status below integrated both produce a valid code fallback. */
export class AssetRegistry {
  private readonly cache = new Map<string, Promise<LoadedActionAsset>>();
  private readonly owned: Group[] = [];
  private readonly loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  readonly placeholders: { type: 'asset.placeholder'; id: string; reason: string }[] = [];
  constructor(private readonly materials: Materials) {}
  async loadAsset(id: string): Promise<LoadedActionAsset> {
    const entry = manifest.find((e) => e.id === id); if (!entry || entry.category !== 'weapon') throw new Error(`Unknown action asset: ${id}`);
    let promise = this.cache.get(id);
    if (!promise) {
      promise = (async () => {
        let model: Group | undefined, source: LoadedActionAsset['source'] = 'glb', reason: string | null = null;
        try {
          if (entry.status !== 'integrated' || !entry.glb) throw new Error('Asset below integrated status');
          const url = modelUrls[`../../${entry.glb}`]; if (!url) throw new Error('Missing asset URL');
          model = (await this.loader.loadAsync(url)).scene;
          for (const name of entry.requiredNodes) if (!model.getObjectByName(name)) throw new Error(`Missing ${id}.${name}`);
        } catch (error) {
          if (model) this.release(model, true);
          reason = String(error); source = 'placeholder'; model = actionPlaceholder(entry.placeholder);
          this.placeholders.push({ type: 'asset.placeholder', id, reason });
        }
        const oldMaterials = new Set<Material>();
        model.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          const remap = (original: Material): Material => {
            oldMaterials.add(original); const token = original.name.replace(/^pal_/, '') as PaletteToken;
            const material = paletteTokens.includes(token) ? this.materials.get(token) : this.materials.fromColor(original.name, (original as MeshStandardMaterial).color);
            material.userData.sharedPalette = true; return material;
          };
          node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material); node.castShadow = node.receiveShadow = true;
        });
        for (const material of oldMaterials) material.dispose();
        const grip = model.getObjectByName('grip')!, offset = new Vector3(); model.updateMatrixWorld(true); grip.getWorldPosition(offset); model.position.sub(offset);
        this.owned.push(model); return { model, source, reason };
      })(); this.cache.set(id, promise);
    }
    const asset = await promise; return { ...asset, model: asset.model.clone(true) };
  }
  private release(model: Group, materials = false): void {
    const geometries = new Set<import('three').BufferGeometry>(), ownedMaterials = new Set<Material>();
    model.traverse((node) => { if (node instanceof Mesh) { geometries.add(node.geometry); if (materials) for (const material of Array.isArray(node.material) ? node.material : [node.material]) ownedMaterials.add(material); } });
    for (const geometry of geometries) geometry.dispose(); for (const material of ownedMaterials) material.dispose();
  }
  dispose(): void { for (const model of this.owned) this.release(model); this.owned.length = 0; this.cache.clear(); }
}
