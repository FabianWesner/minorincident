import { expect, test } from 'vitest';
import { BoxGeometry, Matrix4, MeshBasicMaterial, Vector3 } from 'three/webgpu';
import { batchPerimeterPosts } from '../../../src/render/PerimeterPosts';

test('perimeter instances preserve every post and its exact geometry, material, placement and shadow policy', () => {
  const points: [number, number, number][] = Array.from({ length: 4310 }, (_, i) => [i * 2 - 4200.08, .525, i % 2 ? -100.08 : 100.08]);
  const geometry = new BoxGeometry(.16, 1.05, .16), material = new MeshBasicMaterial(), matrix = new Matrix4();
  const batches = batchPerimeterPosts(points, geometry, material), actual: number[][] = [];
  for (const mesh of batches) {
    expect(mesh.geometry).toBe(geometry); expect(mesh.material).toBe(material); expect(mesh.castShadow).toBe(false); expect(mesh.receiveShadow).toBe(true);
    // One straight fence line per cell edge: posts every 2 m across a 128 m cell (level handover: fewer cells, fewer shader builds).
    expect(mesh.count).toBeLessThanOrEqual(64); expect(mesh.boundingSphere).not.toBeNull();
    for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); actual.push(new Vector3().setFromMatrixPosition(matrix).toArray()); }
    mesh.dispose();
  }
  expect(actual.sort((a,b) => a[0] - b[0])).toEqual(points.map(p => p.map(Math.fround)));
  expect(batches.length).toBeLessThan(points.length / 3);
  geometry.dispose(); material.dispose();
});
