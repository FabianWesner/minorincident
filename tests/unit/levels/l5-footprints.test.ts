import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { Box3, Mesh, Vector3, type Object3D } from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { l5ShellAssets } from '../../../src/levels/L5/layout';

/** Project the shipped mesh triangles onto the same XZ raster, including every transformed child. */
function footprint(root: Object3D, bounds: Box3, size = 256): Uint8Array {
  const mask = new Uint8Array(size * size), point = new Vector3();
  const sx = size / (bounds.max.x - bounds.min.x), sz = size / (bounds.max.z - bounds.min.z);
  root.traverse(child => {
    if (!(child instanceof Mesh)) return;
    const geometry = child.geometry, positions = geometry.getAttribute('position'), index = geometry.index;
    const points = Array.from({ length: positions.count }, (_, i) => {
      point.fromBufferAttribute(positions, i).applyMatrix4(child.matrixWorld);
      return [(point.x - bounds.min.x) * sx, (point.z - bounds.min.z) * sz];
    });
    for (let i = 0, count = index?.count ?? positions.count; i < count; i += 3) {
      const [a, b, c] = [0, 1, 2].map(k => points[index ? index.getX(i + k) : i + k]);
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (Math.abs(area) < 1e-8) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(size - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const z0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), z1 = Math.min(size - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const px = x + .5, pz = z + .5;
        const u = ((b[0] - px) * (c[1] - pz) - (b[1] - pz) * (c[0] - px)) / area;
        const v = ((c[0] - px) * (a[1] - pz) - (c[1] - pz) * (a[0] - px)) / area;
        if (u >= 0 && v >= 0 && u + v <= 1) mask[z * size + x] = 1;
      }
    }
  });
  return mask;
}

test('T-E23-05c @E23 @E23-AC05 shipped W5 hero geometry retains a top-down footprint mask IoU >= 0.9', async () => {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder), report: Record<string, number> = {};
  for (const id of l5ShellAssets) {
    const roots: Object3D[] = [];
    for (const suffix of ['', '.w5']) {
      const file = readFileSync(`public/assets/models/${id}${suffix}.glb`);
      const root = (await loader.parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')).scene;
      root.updateMatrixWorld(true); roots.push(root);
    }
    const bounds = new Box3().setFromObject(roots[0]).union(new Box3().setFromObject(roots[1]));
    const [safe, fallen] = roots.map(root => footprint(root, bounds));
    let union = 0, intersection = 0;
    for (let i = 0; i < safe.length; i++) { if (safe[i] || fallen[i]) union++; if (safe[i] && fallen[i]) intersection++; }
    expect(union, id).toBeGreaterThan(0); report[id] = intersection / union;
    expect(report[id], id).toBeGreaterThanOrEqual(.9);
    for (const root of roots) root.traverse(child => { if (child instanceof Mesh) { child.geometry.dispose(); for (const material of Array.isArray(child.material) ? child.material : [child.material]) material.dispose(); } });
  }
  mkdirSync('test-results/epics/E23', { recursive: true });
  writeFileSync('test-results/epics/E23/hero-footprints.json', JSON.stringify(report, null, 2));
});
