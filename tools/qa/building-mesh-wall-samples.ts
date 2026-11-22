import { Matrix4, Vector3 } from 'three';
import { assetIO } from '../assets/io';
import { existsSync } from 'node:fs';
import manifest from '../../src/assets/manifest.json' with { type: 'json' };

/** Vertical mesh intersections at local body height, independent of collider data. */
export async function buildingMeshWallSamples(): Promise<Map<string, { x: number; z: number; nx: number; nz: number }[]>> {
  const io = await assetIO(), result = new Map<string, { x: number; z: number; nx: number; nz: number }[]>();
  for (const { id } of manifest.filter(asset => asset.id.startsWith('bld.') && existsSync(`public/assets/models/${asset.id}.glb`))) {
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
          if (normal.length() < 1e-6) continue;
          normal.normalize();
          if (Math.abs(normal.y) >= .15) continue;
          const intersections: Vector3[] = [];
          for (let j = 0; j < 3; j++) {
            const a = vertices[j], b = vertices[(j + 1) % 3];
            if ((a.y <= 1 && b.y > 1) || (b.y <= 1 && a.y > 1)) intersections.push(a.clone().lerp(b, (1 - a.y) / (b.y - a.y)));
          }
          if (intersections.length !== 2 || intersections[0].distanceTo(intersections[1]) < .5) continue;
          const centre = intersections[0].add(intersections[1]).multiplyScalar(.5);
          samples.push({ x: centre.x, z: centre.z, nx: normal.x, nz: normal.z });
        }
      }
    }
    result.set(id, samples);
  }
  return result;
}
