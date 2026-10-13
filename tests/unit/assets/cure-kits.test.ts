import { readFileSync, statSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Document } from '@gltf-transform/core';
import manifest from '../../../src/assets/manifest.json';
import type { AssetDef } from '../../../src/assets/types';
import { assetIO } from '../../../tools/assets/io';
import { coplanarOverlaps } from '../../../tools/assets/zfight';
import { validateDocument } from '../../../tools/assets/validate';

// L10-A4: residential fringe + industrial region kits (spec epic 32 section 5.9, inventory section 8).
// [id, LOD0/LOD1/LOD2 triangle caps, max KB, max height m]. PO: "There should be no skyscrapers."
const kits: [string, [number, number, number], number, number][] = [
  ['bld.cure-duplex', [12000, 4000, 1500], 1000, 12],
  ['bld.cure-security-post', [12000, 4000, 1500], 1000, 12],
  ['prop.cure-garden-wall', [1000, 400, 150], 300, 3],
  ['bld.cure-warehouse', [16000, 6000, 2000], 1200, 14],
  ['bld.cure-service-building', [16000, 6000, 2000], 1200, 12],
  ['prop.cure-container-stack', [3000, 1000, 300], 400, 6],
  ['prop.cure-drum-stack', [3000, 1000, 300], 400, 3],
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

for (const [id, caps, maxKB, maxHeight] of kits) {
  for (const lod of [0, 1, 2]) {
    test(`T-L10-cure-kit-${id}-lod${lod} @L10 ${id}: per-LOD triangle cap, <=4 materials, closed solids, z-fight clean, low-rise`, async () => {
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
      expect(validation.materials).toBeLessThanOrEqual(4);
      expect(validation.fileKB).toBeLessThanOrEqual(maxKB);
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

test('T-L10-cure-kit-source @L10 every kit module is built from the shared cure_kits recipe module and registered with the forward/front contract', () => {
  for (const [id] of kits) {
    const def = find(id);
    expect(readFileSync(`assets/${id}/build.py`, 'utf8')).toContain('sslib.cure_kits');
    expect(def.forward).toBe('+X');
    expect(def.frontNodes).toEqual(['front']);
    expect(def.status).toBe('integrated');
  }
});
