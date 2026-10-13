import { statSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Document } from '@gltf-transform/core';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { coplanarOverlaps } from '../../../tools/assets/zfight';
import { validateDocument } from '../../../tools/assets/validate';

// L10-A7: kit.dispersal-* (specs/05-asset-inventory.md section 7.2). [id, LOD0/LOD1/LOD2 triangle caps, max height m].
// <= 8 materials, <= 300 KB per file; no skyscrapers (PO).
const kit: [string, [number, number, number], number][] = [
  ['kit.dispersal-fan-housing', [5000, 2000, 900], 12],
  ['kit.dispersal-turbine-hall', [4000, 1800, 1200], 12],
  ['kit.dispersal-tank-sphere', [2800, 1200, 700], 14],
  ['kit.dispersal-tank-bullet', [3000, 1500, 700], 10],
  ['kit.dispersal-filtration-tower', [4000, 1600, 800], 18],
  ['kit.dispersal-platform', [1800, 900, 600], 6],
  ['kit.dispersal-console', [600, 300, 200], 3],
  ['kit.dispersal-pipe-straight', [1200, 500, 250], 5],
  ['kit.dispersal-pipe-elbow', [1600, 600, 300], 5],
  ['kit.dispersal-pipe-tee', [1700, 700, 300], 6],
];
const find = (id: string) => manifest.find(a => a.id === id) as AssetDef;
const lodPath = (def: AssetDef, lod: number) => lod === 0 ? def.glb : def.lods![lod === 1 ? 'lod1' : 'lod2']!;
const sourcePath = (id: string, lod: number) => `assets/${id}/model${lod ? `.lod${lod}` : ''}.glb`;
/** Edge multiplicity per material primitive: separate closed solids may touch, so every edge count is even. */
function openEdges(doc: Document) {
  const bad: string[] = [];
  for (const node of doc.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const edges = new Map<string, number>();
    const positions = primitive.getAttribute('POSITION')!, indices = primitive.getIndices()!;
    const point: number[] = [];
    for (let i = 0; i < indices.getCount(); i += 3) {
      const corners = [0, 1, 2].map(k => { positions.getElement(indices.getScalar(i + k), point); return point.map(v => Math.round(v * 10000)).join(','); });
      for (let k = 0; k < 3; k++) {
        const edge = [corners[k], corners[(k + 1) % 3]].sort().join('|');
        edges.set(edge, (edges.get(edge) ?? 0) + 1);
      }
    }
    if (![...edges.values()].every(n => n % 2 === 0)) bad.push(`${node.getName()}/${primitive.getMaterial()?.getName()}`);
  }
  return bad;
}
function extent(doc: Document) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const point: number[] = [];
  for (const node of doc.getRoot().listNodes()) for (const primitive of node.getMesh()?.listPrimitives() ?? []) {
    const positions = primitive.getAttribute('POSITION')!;
    for (let i = 0; i < positions.getCount(); i++) {
      positions.getElement(i, point);
      for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], point[k]); max[k] = Math.max(max[k], point[k]); }
    }
  }
  return max.map((v, k) => v - min[k]);
}

for (const [id, caps, maxHeight] of kit) {
  for (const lod of [0, 1, 2]) {
    test(`T-L10-dispersal-${id}-lod${lod} @L10 ${id}: per-LOD triangle cap, <=8 materials, <=300 KB, closed solids, z-fight clean, low-rise`, async () => {
      const def = find(id);
      expect(def, 'registered in the manifest').toBeTruthy();
      expect(def.budget.triangles).toBe(caps[0]);
      expect(def.authoredLodTriangles).toEqual({ lod1: caps[1], lod2: caps[2] });
      const io = await assetIO();
      const path = lodPath(def, lod);
      const doc = await io.read(path);
      const validation = validateDocument(doc, def, statSync(path).size, lod);
      expect(validation.errors).toEqual([]);
      expect(validation.triangles).toBeLessThanOrEqual(caps[lod]);
      expect(validation.materials).toBeLessThanOrEqual(8);
      expect(validation.fileKB).toBeLessThanOrEqual(300);
      expect(coplanarOverlaps(doc), 'no coplanar overlapping surfaces').toEqual([]);
      expect(openEdges(await io.read(sourcePath(id, lod))), 'authored closed solids at every tier').toEqual([]);
      const size = extent(doc);
      expect(size[1], 'no skyscrapers').toBeLessThanOrEqual(maxHeight);
      if (lod > 0) {
        const base = extent(await io.read(def.glb));
        for (let k = 0; k < 3; k++) expect(Math.abs(size[k] - base[k]), `extent axis ${k} matches LOD0`).toBeLessThan(.3);
      }
    });
  }
}
