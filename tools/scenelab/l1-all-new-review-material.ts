import { BufferAttribute, MeshLambertNodeMaterial, type Material, type Mesh, type Object3D } from 'three/webgpu';
import { mix, texture, uv } from 'three/tsl';
import { crowdRegionOf, crowdRegionTint } from '../../src/render/characters/crowdRegions';
import { crowdRegion } from '../../src/render/characters/crowdRegionData';
import type { Materials } from '../../src/render/Materials';

/** Raw atlases store normalised skin for the crowd shader, not display RGB.
 * Keep canonical garment paint for the identity comparison, but show skin with
 * the production tint function and an explicit palette index. */
export function reviewSkinTone(root: Object3D, tone: number, shading: Materials): void {
  root.traverse(node => {
    const mesh = node as Mesh; if (!mesh.isMesh || mesh.userData.crowdEye) return;
    const count = mesh.geometry.getAttribute('position').count;
    const variants = new Float32Array(count * 4), parts = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) { variants[i * 4 + 1] = tone * 2; parts[i * 4 + 1] = -10; }
    mesh.geometry.setAttribute('_variant', new BufferAttribute(variants, 4));
    mesh.geometry.setAttribute('_parts', new BufferAttribute(parts, 4));
    const convert = (source: Material) => {
      const original = source as MeshLambertNodeMaterial; if (!original.map) return source;
      const atlas = texture(original.map), region = crowdRegionOf(atlas, uv());
      // Arithmetic mix keeps the shared texture sample outside conditional
      // shader blocks (a select can leave its other branch's sample undefined).
      const material = shading.shaded(mix(atlas.rgb, crowdRegionTint(atlas.rgb, region), region.equal(crowdRegion.skin).select(1, 0)));
      material.side = original.side;
      material.userData.reviewEyeMask = true; // Same owned-material disposal path.
      return material;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(convert) : convert(mesh.material);
  });
}

/** The production crowd's infection-eye disc mask, for standalone review meshes. */
export function reviewEyeMaterial(source: Material): MeshLambertNodeMaterial {
  const material = new MeshLambertNodeMaterial().copy(source);
  material.maskNode = uv().sub(.5).mul(2).length().lessThanEqual(1);
  material.userData.reviewEyeMask = true;
  return material;
}
