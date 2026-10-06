import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import manifest from '../../src/assets/manifest.json';
import { assetIO } from './io';
import type { Aabb } from '../../src/levels/districts/types';

/** Compound boxes from connected GLB geometry intersecting the body-height slab.
 * Welding positions reconnects palette/UV seams. Roofs, floors, lights and signs
 * above the survivor never turn the open space beneath them into a blocker. */
export async function bakeStaticCollision(path: string): Promise<Aabb[]> {
  const io = await assetIO(), doc = await io.read(path), boxes: Aabb[] = [];
  const point = new Vector3();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const matrix = new Matrix4().fromArray(node.getWorldMatrix());
    // Merge connected geometry across materials in the same delivered node.
    const vertices: number[][] = [], triangles: number[][] = [], welded = new Map<string, number>();
    for (const primitive of mesh.listPrimitives()) {
      const positions = primitive.getAttribute('POSITION'); if (!positions) continue;
      const lookup: number[] = [];
      for (let i = 0; i < positions.getCount(); i++) {
        const value: number[] = []; positions.getElement(i, value); point.fromArray(value).applyMatrix4(matrix);
        const p = point.toArray(), key = p.map(v => Math.round(v * 10000)).join(',');
        let index = welded.get(key); if (index === undefined) { index = vertices.length; welded.set(key, index); vertices.push(p); }
        lookup.push(index);
      }
      const indices = primitive.getIndices();
      for (let i = 0; i < (indices?.getCount() ?? lookup.length); i += 3) triangles.push([0, 1, 2].map(j => lookup[indices ? indices.getScalar(i + j) : i + j]));
    }
    const parents = vertices.map((_, i) => i);
    const root = (i: number): number => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    for (const t of triangles) { parents[root(t[1])] = root(t[0]); parents[root(t[2])] = root(t[0]); }
    const components = new Map<number, Aabb>();
    for (const triangle of triangles) {
      let polygon = triangle.map(i => vertices[i]);
      for (const [height, above] of [[.18, true], [1.65, false]] as const) {
        const clipped: number[][] = [];
        for (let i = 0; i < polygon.length; i++) {
          const a = polygon[i], b = polygon[(i + 1) % polygon.length], inside = above ? a[1] >= height : a[1] <= height, next = above ? b[1] >= height : b[1] <= height;
          if (inside) clipped.push(a);
          if (inside !== next) { const t = (height - a[1]) / (b[1] - a[1]); clipped.push(a.map((v, j) => v + (b[j] - v) * t)); }
        }
        polygon = clipped;
      }
      if (!polygon.length) continue;
      const id = root(triangle[0]), box = components.get(id) ?? { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const p of polygon) for (let axis = 0; axis < 3; axis++) { box.min[axis] = Math.min(box.min[axis], p[axis]); box.max[axis] = Math.max(box.max[axis], p[axis]); }
      components.set(id, box);
    }
    for (const box of components.values()) {
      // Thin decal faces are decoration. Solid walls/posts have volume in X/Z.
      if (box.max[0] - box.min[0] < .025 || box.max[2] - box.min[2] < .025 || box.max[1] - box.min[1] < .025) continue;
      if (box.max[1] < .45 && (box.max[0] - box.min[0]) * (box.max[2] - box.min[2]) > .5) continue;
      boxes.push({ min: box.min.map(v => +v.toFixed(4)) as Aabb['min'], max: box.max.map(v => +v.toFixed(4)) as Aabb['max'] });
    }
  }
  // Coalesce neighboring trim/bricks/leaves only when their union stays rectangular.
  // Separate canopy legs remain separate; an L-shaped wall cannot fill a forecourt.
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if ([0, 1, 2].some(axis => a.max[axis] + .035 < b.min[axis] || b.max[axis] + .035 < a.min[axis])) continue;
      const min = a.min.map((v, axis) => Math.min(v, b.min[axis])) as Aabb['min'], max = a.max.map((v, axis) => Math.max(v, b.max[axis])) as Aabb['max'];
      const volume = (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]);
      const size = (box: Aabb) => box.max.reduce((v, value, axis) => v * (value - box.min[axis]), 1);
      const intersection = a.max.reduce((v, value, axis) => v * Math.max(0, Math.min(value, b.max[axis]) - Math.max(a.min[axis], b.min[axis])), 1);
      if (volume > (size(a) + size(b) - intersection) * 1.12 + .001) continue;
      boxes[i] = { min, max }; boxes.splice(j--, 1); changed = true;
    }
    if (!changed) break;
  }
  // Remove contained component boxes (windows/trim in wall bodies).
  return boxes.filter((box, i) => !boxes.some((other, j) => j !== i && other.min.every((v, a) => v <= box.min[a]) && other.max.every((v, a) => v >= box.max[a]) && (j < i || other.min.some((v, a) => v < box.min[a]) || other.max.some((v, a) => v > box.max[a]))));
}

if (process.argv[1]?.endsWith('bake-static-collision.ts')) {
  const assets: Record<string, { source: string; hash: string; boxes: Aabb[] }> = {};
  const aliases: Record<string, string> = { 'bld.pharmacy': 'int.pharmacy-clinic', 'prop.tree': 'prop.hedge' };
  for (const def of manifest.filter(a => 'world' in a && a.world && a.id !== 'prop.flower')) {
    const source = manifest.find(a => a.id === (aliases[def.id] ?? def.id))!;
    if (source.status !== 'integrated' && source.status !== 'final') continue;
    const boxes = await bakeStaticCollision(source.glb);
    assets[def.id] = { source: source.glb, hash: createHash('sha256').update(readFileSync(source.glb)).digest('hex'), boxes };
    console.log(def.id, boxes.length);
  }
  writeFileSync('src/assets/staticCollision.json', JSON.stringify(assets) + '\n');
}
