import { Matrix4, Vector3 } from 'three';
import { assetIO } from '../assets/io';

/** Large vertical triangles in the shipped LOD0 mesh, independent of collider data. */
export async function farmMeshWallSamples(): Promise<Map<string, { x: number; z: number; nx: number; nz: number }[]>> {
  const io = await assetIO(), result = new Map<string, { x: number; z: number; nx: number; nz: number }[]>();
  for (const id of ['bld.farm-house-ruin', 'bld.farm-barn-ruin']) {
    const doc = await io.read(`public/assets/models/${id}.glb`), samples: { x: number; z: number; nx: number; nz: number }[] = [];
    for (const node of doc.getRoot().listNodes()) {
      const matrix = new Matrix4().fromArray(node.getWorldMatrix());
      for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
        const positions = primitive.getAttribute('POSITION'), index = primitive.getIndices();
        if (!positions) continue;
        for (let i = 0; i < (index?.getCount() ?? positions.getCount()); i += 3) {
          const vertices = [0, 1, 2].map(j => {
            const value: number[] = []; positions.getElement(index ? index.getScalar(i + j) : i + j, value);
            return new Vector3().fromArray(value).applyMatrix4(matrix);
          });
          const normal = new Vector3().crossVectors(vertices[1].clone().sub(vertices[0]), vertices[2].clone().sub(vertices[0]));
          if (normal.length() < 4) continue;
          normal.normalize();
          const centre = vertices[0].clone().add(vertices[1]).add(vertices[2]).divideScalar(3);
          if (Math.abs(normal.y) < .15 && centre.y > .5 && centre.y < 1.8) samples.push({ x: centre.x, z: centre.z, nx: normal.x, nz: normal.z });
        }
      }
    }
    result.set(id, samples);
  }
  return result;
}
