import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Matrix4, Vector3 } from 'three';
import manifest from '../../src/assets/manifest.json';
import { staticCollision } from '../../src/assets/staticCollision';
import { assetIO } from './io';
import type { Aabb } from '../../src/levels/districts/types';

/** Compound boxes from connected GLB geometry intersecting the body-height slab.
 * Welding positions reconnects palette/UV seams. Roofs, floors, lights and signs
 * above the survivor never turn the open space beneath them into a blocker. */
export async function bakeStaticCollision(path: string): Promise<Aabb[]> {
  const io = await assetIO(), doc = await io.read(path), boxes: Aabb[] = [];
  const point = new Vector3();
  let authoredShell: Aabb[] | undefined;
  // This asset deliberately authors an enterable shell. Connected decorative masonry
  // otherwise produces a single AABB across both bay apertures. Sizes are Blender XYZ;
  // the delivered GLB uses Y-up, so swap authored width/height before transforming.
  if (path.includes('bld.fire-station')) {
    const shell = doc.getRoot().listNodes().filter(node => node.getName().startsWith('col:') && node.getExtras().collider === 'cuboid');
    if (!shell.length) throw new Error('Fire station is missing its authored collision shell');
    authoredShell = shell.map(node => {
      const size = node.getExtras().size as number[], matrix = new Matrix4().fromArray(node.getWorldMatrix());
      const box: Aabb = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const x of [-size[0] / 2, size[0] / 2]) for (const y of [-size[2] / 2, size[2] / 2]) for (const z of [-size[1] / 2, size[1] / 2]) {
        point.set(x, y, z).applyMatrix4(matrix);
        for (let axis = 0; axis < 3; axis++) { box.min[axis] = Math.min(box.min[axis], point.getComponent(axis)); box.max[axis] = Math.max(box.max[axis], point.getComponent(axis)); }
      }
      return { min: box.min.map(v => +v.toFixed(4)) as Aabb['min'], max: box.max.map(v => +v.toFixed(4)) as Aabb['max'] };
    });
  }
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
      boxes.push({ min: box.min.map(v => +v.toFixed(4)) as Aabb['min'], max: box.max.map(v => +v.toFixed(4)) as Aabb['max'] });
    }
  }
  const ground = boxes.filter(box => box.max[1] < .45);
  if (authoredShell) return ground.filter(box => (box.max[0] - box.min[0]) * (box.max[2] - box.min[2]) >= .15).concat(authoredShell);
  for (let i = boxes.length - 1; i >= 0; i--) if (boxes[i].max[1] < .45) boxes.splice(i, 1);
  // Coalesce neighboring trim/bricks/leaves only when their union stays rectangular.
  // Separate canopy legs remain separate; an L-shaped wall cannot fill a forecourt.
  for (let pass = 0; pass < 8; pass++) {
    let changed = false;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if ([0, 1, 2].some(axis => a.max[axis] + .035 < b.min[axis] || b.max[axis] + .035 < a.min[axis])) continue;
      const min = a.min.map((v, axis) => Math.min(v, b.min[axis])) as Aabb['min'], max = a.max.map((v, axis) => Math.max(v, b.max[axis])) as Aabb['max'];
      const area = (max[0] - min[0]) * (max[2] - min[2]);
      const size = (box: Aabb) => (box.max[0] - box.min[0]) * (box.max[2] - box.min[2]);
      const intersection = Math.max(0, Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0])) * Math.max(0, Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]));
      if (area > (size(a) + size(b) - intersection) * 1.1 + .001) continue;
      boxes[i] = { min, max }; boxes.splice(j--, 1); changed = true;
    }
    if (!changed) break;
  }
  // Retain broad paving/steps; leaves, trim and feet inside solid footprints
  // are neither walkable supports nor thousands of tiny Rapier contacts.
  const supports = ground.filter(a => (a.max[0] - a.min[0]) * (a.max[2] - a.min[2]) >= .15 && !boxes.some(b => b.min[0] <= a.min[0] && b.max[0] >= a.max[0] && b.min[2] <= a.min[2] && b.max[2] >= a.max[2]));
  // Remove contained component boxes (windows/trim in wall bodies).
  return supports.concat(boxes.filter((box, i) => !boxes.some((other, j) => j !== i && other.min.every((v, a) => v <= box.min[a]) && other.max.every((v, a) => v >= box.max[a]) && (j < i || other.min.some((v, a) => v < box.min[a]) || other.max.some((v, a) => v > box.max[a])))));

}

export async function writeStaticCollision(): Promise<void> {
  const assets: Record<string, { source: string; hash: string; boxes: Aabb[] }> = {};
  const aliases: Record<string, string> = { 'bld.pharmacy': 'int.pharmacy-clinic', 'prop.tree': 'prop.street-tree' };
  // Include delivered solid dressing even before a district starts using it.
  // Pickups/equipment/decals are not static district obstacles.
  for (const def of manifest.filter(a => (('world' in a && a.world) || a.id.startsWith('prop.') || a.id.startsWith('veh.')) && a.id !== 'prop.flower')) {
    const source = manifest.find(a => a.id === (aliases[def.id] ?? def.id))!;
    if (source.status !== 'integrated' && source.status !== 'final') continue;
    const hash = createHash('sha256').update(readFileSync(source.glb)).digest('hex');
    const cached = staticCollision[def.id];
    // Alias fitting depends on manifest dimensions as well as source bytes.
    if (def.id !== 'bld.fire-station' && !aliases[def.id] && cached?.source === source.glb && cached.hash === hash) {
      assets[def.id] = cached; continue;
    }
    let boxes = await bakeStaticCollision(source.glb);
    if (def.id === 'bld.pharmacy') {
      const straight = Math.min(1, def.dimensions.x / source.dimensions.x, def.dimensions.z / source.dimensions.z), turned = Math.min(1, def.dimensions.x / source.dimensions.z, def.dimensions.z / source.dimensions.x);
      const fit = Math.max(straight, turned);
      boxes = boxes.map(box => turned > straight ? { min: [box.min[2] * fit, box.min[1], -box.max[0] * fit], max: [box.max[2] * fit, box.max[1], -box.min[0] * fit] } : { min: [box.min[0] * fit, box.min[1], box.min[2] * fit], max: [box.max[0] * fit, box.max[1], box.max[2] * fit] });
    }
    assets[def.id] = { source: source.glb, hash, boxes };
    console.log(def.id, boxes.length);
  }
  writeFileSync('src/assets/staticCollision.ts', '// Generated by tools/assets/bake-static-collision.ts; do not edit.\nimport type { Aabb } from \'../levels/districts/types\';\nexport const staticCollision: Record<string, { source: string; hash: string; boxes: Aabb[] }> = {\n' + Object.entries(assets).map(([id, data]) => `  ${JSON.stringify(id)}: ${JSON.stringify(data)},`).join('\n') + '\n};\n');
}

if (process.argv[1]?.endsWith('bake-static-collision.ts')) await writeStaticCollision();
