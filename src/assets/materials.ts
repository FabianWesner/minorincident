// Adapted from Bruno Simon folio-2025 Materials.js (MIT).
import { Mesh, Scene, type Material, type Object3D } from 'three/webgpu';
import { palette, type PaletteToken } from '../data/palette';
import { Materials } from '../render/Materials';
import { Lighting } from '../render/Lighting';

/** Imported assets use the same shadow, bounce and fog graph as the world. */
export class AssetMaterials {
  private readonly fallbackLighting?: Lighting;
  private readonly shading: Materials;
  constructor(shading?: Materials) {
    this.fallbackLighting = shading ? undefined : new Lighting(new Scene());
    this.shading = shading ?? new Materials(this.fallbackLighting!);
  }
  swap(root: Object3D, world = false, hydrant = false): void {
    root.traverse(node => {
      if (!(node instanceof Mesh)) return;
      const replace = (source: Material): Material => {
        const match = source.name.match(/^(pal|emi)_(.+)$/);
        if (!match || !Object.hasOwn(palette, match[2])) {
          const imported = source as Material & { color?: import('three').Color };
          if (!imported.color) return source;
          const material = this.shading.fromColor(`${source.name}:${source.opacity}:${source.side}`, imported.color, source.name === 'keep_neon' ? 2 : 0, world);
          material.transparent = source.transparent; material.fade.value = source.opacity; material.side = source.side; material.userData.sharedPalette = true;
          return material;
        }
        const token = match[2] as PaletteToken;
        let open = false;
        if (root.userData.diner && token === 'survivorRed') for (let parent = node.parent; parent; parent = parent.parent) if (parent.name === 'door_front') { open = true; break; }
        const emissive = match[1] === 'emi' || open || world && token === 'windowGlow' ? 2 : 0;
        const vertexColors = !emissive && node.geometry.hasAttribute('color');
        // Preserve authored thin hair/cloth faces in both palette and crowd bakes.
        const material = world ? this.shading.world(token, emissive, vertexColors, source.side) : this.shading.asset(token, emissive, vertexColors, source.side);
        // Hydrants are an explicit D2 saturated-red exception; use the figure identity swatch.
        const result = hydrant && token === 'survivorRed' ? this.shading.asset(token, emissive, vertexColors, source.side) : material;
        result.userData.sharedPalette = true;
        return result;
      };
      node.material = Array.isArray(node.material) ? node.material.map(replace) : replace(node.material);
    });
  }
  dispose(): void { if (this.fallbackLighting) { this.shading.dispose(); this.fallbackLighting.dispose(); } }
}
