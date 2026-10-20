/** Authored-boundary audit, not a coarse grid: thin plinths and diagonal polygons
 * are sampled every <= 0.5 m against the combined gameplay height field. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Matrix4, Vector3, Triangle, Box3, Quaternion } from 'three';
import { compositions } from '../../src/levels/compositions';
import { levelTwoLayouts } from '../../src/levels/L2/layout';
import { levelThreeLayouts } from '../../src/levels/L3/layout';
import { levelFourLayouts } from '../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../src/levels/L5/layout';
import { levelSevenLayouts } from '../../src/levels/L7/layout';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import { heightSteps, type HeightStep } from '../../src/sim/world/HeightSteps';
import type { DistrictLayout } from '../../src/levels/districts/types';
import { assetIO } from '../assets/io';
import { heightStepVertices } from '../../src/render/HeightStepEdges';
import { worldAssets } from '../../src/assets/worldDefinitions';
import { productionIds } from '../../src/assets/productionIds';
import { variantPath } from '../../src/assets/types';
import type { Document } from '@gltf-transform/core';

const out = 'test-results/l7-readability', io = await assetIO();
mkdirSync(out, { recursive: true });
const withoutL7 = process.argv.includes('--without-l7-edges');
const results = [];
const documents = new Map<string, Document>();
for (let level = 1; level <= 10; level++) {
  const id = `L${level}`, composition = compositions[id];
  let layouts = composition.districts.map(d => JSON.parse(readFileSync(`public/assets/layouts/${d.id}.layout.json`, 'utf8')) as DistrictLayout);
  layouts = level === 2 ? levelTwoLayouts(layouts, null) : level === 3 ? levelThreeLayouts(layouts) : level === 4 ? levelFourLayouts(layouts) : level === 5 ? levelFiveLayouts(layouts) : level === 7 ? levelSevenLayouts(layouts) : layouts;
  const world = new DistrictWorld(composition, layouts, 2), steps = heightSteps(world);
  // Vertical rendered faces from ground GLBs; use material-authored rim/kerb
  // geometry as well. Placement solids are checked separately below.
  const triangles: { triangle: Triangle; bounds: Box3 }[] = [];
  for (const d of world.districts) {
    for (let tier = 0; tier <= Math.min(composition.tier, Math.max(5, ...d.layout.layers.map(l => l.tier))); tier++) {
      const file = `public/assets/layouts/${d.id}.${tier === 0 ? d.layout.terrainChunks?.length ? 'horizon' : 'base' : `w${tier}`}.glb`;
      if (!existsSync(file)) continue;
      await inspect(file, new Matrix4().makeTranslation(d.origin[0], 0, d.origin[1]), steps, new Set(d.decay.removed), true, triangles);
    }
    for (const chunk of d.layout.terrainChunks ?? []) {
      const bounds = new Box3(new Vector3(chunk.origin[0] + d.origin[0], -Infinity, chunk.origin[1] + d.origin[1]), new Vector3(chunk.origin[0] + d.origin[0] + chunk.size, Infinity, chunk.origin[1] + d.origin[1] + chunk.size));
      const nearby = steps.filter(s => overlaps(s, bounds)); if (!nearby.length) continue;
      await inspect(`public/assets/layouts/${d.id}.chunks/${chunk.id}.glb`, new Matrix4().makeTranslation(chunk.origin[0] + d.origin[0], 0, chunk.origin[1] + d.origin[1]), nearby, new Set(), true, triangles);
    }
    for (const p of d.decay.placements) {
      const bounds = new Box3(new Vector3().fromArray(p.visualAabb.min).add(new Vector3(d.origin[0], 0, d.origin[1])), new Vector3().fromArray(p.visualAabb.max).add(new Vector3(d.origin[0], 0, d.origin[1])));
      const nearby = steps.filter(s => overlaps(s, bounds)); if (!nearby.length) continue;
      const def = worldAssets[productionIds[p.assetId] ?? p.assetId]; if (!def?.glb) continue;
      const variant = variantPath(def.glb, p.decay), file = existsSync(variant) ? variant : def.glb;
      const matrix = new Matrix4().compose(new Vector3(p.position[0] + d.origin[0], p.position[1], p.position[2] + d.origin[1]), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.yaw), new Vector3().fromArray(p.scale));
      if (productionIds[p.assetId]) {
        const target = worldAssets[p.assetId].dimensions, source = def.dimensions;
        const straight = Math.min(1, target.x / source.x, target.z / source.z), turned = Math.min(1, target.x / source.z, target.z / source.x), fit = Math.max(straight, turned);
        matrix.multiply(new Matrix4().makeRotationY(turned > straight ? Math.PI / 2 : 0)).multiply(new Matrix4().makeScale(fit, 1, fit));
      }
      await inspect(file, matrix, nearby, new Set(), false, triangles);
    }
  }
  if (id === 'L7' && !withoutL7) {
    // Inspect the actual retained wall triangles, not just the existence of a source edge.
    const { walls } = heightStepVertices(steps);
    for (let i = 0; i < walls.length; i += 9) {
      const triangle = new Triangle(new Vector3().fromArray(walls, i), new Vector3().fromArray(walls, i + 3), new Vector3().fromArray(walls, i + 6));
      triangles.push({ triangle, bounds: new Box3().setFromPoints([triangle.a, triangle.b, triangle.c]) });
    }
  }
  const probe = new Vector3(), nearest = new Vector3();
  const missing = steps.filter(s => {
    probe.set((s.a[0] + s.b[0]) / 2, s.upper - Math.min(.15, (s.upper - s.lower) / 2), (s.a[1] + s.b[1]) / 2);
    if (triangles.some(t => overlaps(s, t.bounds) && t.triangle.closestPointToPoint(probe, nearest).distanceTo(probe) <= .3)) return false;
    return true;
  });
  const row = { level: id, segments: steps.length, metres: length(steps), missingSegments: missing.length, missingMetres: length(missing), missing };
  results.push(row);
  console.log(`${id}: ${steps.length} segments (${row.metres} m), missing edge geometry within 0.3 m: ${missing.length} (${row.missingMetres} m)`);
}
writeFileSync(`${out}/height-steps${withoutL7 ? '-before' : ''}.json`, JSON.stringify({ method: 'Authored support/paving boundaries at <=0.5 m intervals, >0.3 m combined height difference, drawn layout/placement vertical faces or narrow pale rim within 0.3 m. Non-walkable roofs excluded. L7 procedural faces included unless --without-l7-edges.', results }, null, 2));
function overlaps(s: HeightStep, b: Box3): boolean {
  const x = (s.a[0] + s.b[0]) / 2, z = (s.a[1] + s.b[1]) / 2;
  return x >= b.min.x - .3 && x <= b.max.x + .3 && z >= b.min.z - .3 && z <= b.max.z + .3 && s.upper >= b.min.y && s.lower <= b.max.y;
}
function length(steps: HeightStep[]): number { return +steps.reduce((n, s) => n + Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]), 0).toFixed(2); }

async function inspect(file: string, root: Matrix4, nearby: HeightStep[], removed: Set<string>, layout: boolean, triangles: { triangle: Triangle; bounds: Box3 }[]): Promise<void> {
  if (!existsSync(file)) return;
  let doc = documents.get(file); if (!doc) { doc = await io.read(file); documents.set(file, doc); }
  for (const node of doc.getRoot().listNodes()) {
    if (removed.has(node.getName()) || (layout && typeof node.getExtras().assetId === 'string')) continue;
    const mesh = node.getMesh(); if (!mesh) continue;
    const matrix = root.clone().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute('POSITION'), indices = primitive.getIndices(); if (!position) continue;
      const count = indices?.getCount() ?? position.getCount(), pale = /picketWhite|schoolBusYellow|sidewalk/.test(primitive.getMaterial()?.getName() ?? '');
      const v = (i: number) => new Vector3().fromArray(position.getElement(indices ? indices.getScalar(i) : i, [])).applyMatrix4(matrix);
      for (let i = 0; i < count; i += 3) {
        const triangle = new Triangle(v(i), v(i + 1), v(i + 2)), bounds = new Box3().setFromPoints([triangle.a, triangle.b, triangle.c]);
        if (!nearby.some(s => overlaps(s, bounds))) continue;
        const vertical = Math.abs(triangle.getNormal(new Vector3()).y) <= .7;
        const longest = Math.max(triangle.a.distanceTo(triangle.b), triangle.b.distanceTo(triangle.c), triangle.c.distanceTo(triangle.a));
        const rim = pale && longest > 1e-6 && 2 * triangle.getArea() / longest <= .35;
        if (vertical || rim) triangles.push({ triangle, bounds });
      }
    }
  }
}
