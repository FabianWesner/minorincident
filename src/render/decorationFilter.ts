import { Mesh, Vector3, type BufferGeometry, type Object3D } from 'three/webgpu';
import { strayDecorations } from '../levels/districts/decorationSurface';
import type { DistrictLayout } from '../levels/districts/types';

/** Name of the merged baked daisy mesh in the district GLBs (tools/blender/sslib/l1_dressing.py flower()). */
export const decorationMeshName = 'daisy';

/** Drops the baked daisies that stand on a surface rejecting decorations (PO 10-13 "Flowers growing on stone").
 * Every triangle belongs to its nearest layout decoration (a daisy is at most 18 cm wide); triangles of a stray one are removed.
 * `root` must have identity placement (district-local coordinates). Returns the number of removed flowers. */
export function stripStrayDecorations(root: Object3D, layout: Pick<DistrictLayout, 'surfaces' | 'decorations'>): number {
  const stray = strayDecorations(layout);
  if (!stray.length) return 0;
  const all = layout.decorations ?? [], cell = .5, grid = new Map<string, number[]>(), key = (x: number, z: number) => `${Math.floor(x / cell)}:${Math.floor(z / cell)}`;
  all.forEach((d, i) => { const k = key(d.position[0], d.position[2]); let list = grid.get(k); if (!list) grid.set(k, list = []); list.push(i); });
  const rejected = new Set(stray.map(d => all.indexOf(d)));
  const nearest = (x: number, z: number): number => {
    let best = -1, distance = .3;
    const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const n of grid.get(`${cx + i}:${cz + j}`) ?? []) {
      const d = Math.hypot(all[n].position[0] - x, all[n].position[2] - z);
      if (d < distance) { distance = d; best = n; }
    }
    return best;
  };
  const removedFlowers = new Set<number>();
  root.updateMatrixWorld(true);
  root.traverse(node => {
    if (!(node instanceof Mesh) || !isDecorationMesh(node)) return;
    removeTriangles(node.geometry, node.matrixWorld, (centroid) => { const n = nearest(centroid.x, centroid.z); if (n >= 0 && rejected.has(n)) { removedFlowers.add(n); return true; } return false; });
  });
  return removedFlowers.size;
}

/** GLTFLoader names a multi-material mesh's primitives after the mesh (`daisy`, `daisy_1`, ...) under a group of that name. */
function isDecorationMesh(node: Object3D): boolean {
  for (let o: Object3D | null = node; o; o = o.parent) if (o.name === decorationMeshName || o.name.startsWith(`${decorationMeshName}_`)) return true;
  return false;
}

function removeTriangles(geometry: BufferGeometry, matrix: import('three/webgpu').Matrix4, drop: (centroid: Vector3) => boolean): void {
  const position = geometry.getAttribute('position'), index = geometry.index;
  if (!index) return;
  const source = index.array, a = new Vector3(), b = new Vector3(), c = new Vector3();
  const grouped = geometry.groups.length > 0, groups = grouped ? geometry.groups.slice() : [{ start: 0, count: source.length, materialIndex: 0 }];
  const kept: number[] = [], next: { start: number; count: number; materialIndex?: number }[] = [];
  for (const g of groups) {
    const start = kept.length;
    for (let t = g.start; t < g.start + g.count; t += 3) {
      a.fromBufferAttribute(position, source[t]).applyMatrix4(matrix); b.fromBufferAttribute(position, source[t + 1]).applyMatrix4(matrix); c.fromBufferAttribute(position, source[t + 2]).applyMatrix4(matrix);
      if (drop(a.add(b).add(c).divideScalar(3))) continue;
      kept.push(source[t], source[t + 1], source[t + 2]);
    }
    next.push({ start, count: kept.length - start, materialIndex: g.materialIndex });
  }
  if (kept.length === source.length) return;
  geometry.setIndex(kept);
  if (grouped) { geometry.clearGroups(); for (const g of next) geometry.addGroup(g.start, g.count, g.materialIndex); }
}
