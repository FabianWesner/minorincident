import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Matrix4, Ray, Vector3 } from 'three';
import { wreckRoofs } from '../../src/assets/wreckRoofs';
import { wreckRoofHeight } from '../../src/levels/districts/wreckRoofHeight';
import type { Placement } from '../../src/levels/districts/types';
import { assetIO } from '../../tools/assets/io';

test('@E08 @E23 wreck roof support is baked from the currently shipped vehicle meshes', () => {
  for (const roof of Object.values(wreckRoofs)) expect(createHash('sha256').update(readFileSync(roof.source)).digest('hex'), roof.source).toBe(roof.hash);
});

test('@E08 @E23 bus support matches independent downward rays against the visible GLB roof and hood', async () => {
  const roof = wreckRoofs['veh.school-bus:wrecked'], doc = await (await assetIO()).read(roof.source);
  const vertices: [Vector3, Vector3, Vector3][] = [];
  for (const node of doc.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const matrix = new Matrix4().fromArray(node.getWorldMatrix()), positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices(), value: number[] = [];
    for (let i = 0; i < (indices?.getCount() ?? positions.getCount()); i += 3) {
      const t = [0, 1, 2].map(j => { positions.getElement(indices ? indices.getScalar(i + j) : i + j, value); return new Vector3().fromArray(value).applyMatrix4(matrix); }) as [Vector3, Vector3, Vector3];
      const normal = new Vector3().subVectors(t[1], t[0]).cross(new Vector3().subVectors(t[2], t[0])).normalize();
      if (normal.y >= .5) vertices.push(t);
    }
  }
  const p = { assetId: 'veh.school-bus', decay: 'wrecked', position: [0, 0, 0], yaw: 0, scale: [1, 1, 1] } as Placement;
  for (const x of [-2, 0, 2.8]) for (const z of [0, .6]) {
    const ray = new Ray(new Vector3(x, 10, z), new Vector3(0, -1, 0)), hit = new Vector3();
    let actual = 0;
    for (const t of vertices) if (ray.intersectTriangle(...t, false, hit)) actual = Math.max(actual, hit.y);
    expect(actual, `visible roof at ${x},${z}`).toBeGreaterThan(.45);
    expect(wreckRoofHeight(p, x, z)).toBeCloseTo(actual, 2);
  }
});
