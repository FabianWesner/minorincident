// Adapted from Bruno Simon's Materials.updateObject (MIT): material identity by name.
import { Mesh, MeshLambertNodeMaterial, MeshBasicNodeMaterial, type Material, type Object3D } from 'three/webgpu';
import { palette } from './palette';

export class AssetMaterials {
  private readonly cache = new Map<string, Material>();
  swap(root: Object3D): void {
    root.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const replace = (source: Material): Material => {
        const match = source.name.match(/^(pal|emi)_(.+)$/);
        if (!match || !(match[2] in palette)) return source;
        let material = this.cache.get(source.name);
        if (!material) {
          const created = match[1] === 'emi' ? new MeshBasicNodeMaterial({ color: palette[match[2]] }) : new MeshLambertNodeMaterial({ color: palette[match[2]] });
          if (match[1] === 'emi') created.color.multiplyScalar(3);
          material = created;
          material.name = source.name; this.cache.set(source.name, material);
        }
        return material;
      };
      node.material = Array.isArray(node.material) ? node.material.map(replace) : replace(node.material);
    });
  }
  dispose(): void { for (const material of this.cache.values()) material.dispose(); this.cache.clear(); }
}
