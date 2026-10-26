import { MeshLambertNodeMaterial, type Material } from 'three/webgpu';
import { uv } from 'three/tsl';

/** The production crowd's infection-eye disc mask, for standalone review meshes. */
export function reviewEyeMaterial(source: Material): MeshLambertNodeMaterial {
  const material = new MeshLambertNodeMaterial().copy(source);
  material.maskNode = uv().sub(.5).mul(2).length().lessThanEqual(1);
  material.userData.reviewEyeMask = true;
  return material;
}
