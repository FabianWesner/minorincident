import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { cure, cureRouteLength } from '../../../src/levels/L10/district';
import { validateLayout } from '../../../src/levels/districts/validate';
import { worldAssets } from '../../../src/assets/worldDefinitions';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout } from '../../../src/levels/districts/types';
import { layoutTerrainChunks } from '../../../src/sim/world/TerrainChunks';
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
test('T-E32-03-D1 @E32-AC03 @E32-AC28 R1/R2 geometry, route lengths and pickup anchors agree', () => {
  expect(validateLayout(layout, worldAssets)).toEqual([]);
  expect(cure.regions.map(r => cureRouteLength(r.route))).toEqual([250, 600]);
  expect(cure.regions[0].route.at(-1)).toEqual(cure.regions[1].route[0]);
  expect(layout.anchors['cure-crash'].position).toEqual([547, 0, 0]);
  const w = new DistrictWorld(compositions.L10, [layout], 32);
  expect(w.warnings).toEqual([]);
  expect(w.nav.walkable([937,25])).toBe(false);
  for (const name of ['cure-crash', 'cure-residential', 'police-pickup', 'police-medkit', 'r1-r2-seam', 'r2-r3-seam']) {
    const [x, , z] = layout.anchors[name].position; expect(w.nav.walkable([x, z]), name).toBe(true);
  }
  expect(layout.placements.some(p => p.assetId === 'bld.cure-security-post')).toBe(true);
  expect(layout.placements.some(p => p.assetId === 'bld.cure-duplex')).toBe(true);
  expect(Math.max(...layout.buildings.map(b => b.aabb.max[1]))).toBeLessThan(12);
  const chunks = layoutTerrainChunks(layout); expect(chunks).toHaveLength(32);
  const manifest = JSON.parse(readFileSync('public/assets/layouts/D-CURE.chunks/manifest.json', 'utf8'));
  expect(Object.keys(manifest.triangles)).toEqual(chunks.map(c => c.id));
  expect(Math.max(...Object.values(manifest.triangles) as number[])).toBeLessThanOrEqual(800);
  expect(manifest.horizonTriangles).toBeLessThanOrEqual(10000);
});

test('T-E32-28-D1-ground @E32-AC28 exported cells retain shared 100 m edges within 2 cm', async () => {
  const { NodeIO } = await import('@gltf-transform/core');
  const { getBounds } = await import('@gltf-transform/functions');
  const io = new NodeIO();
  for (const cell of layoutTerrainChunks(layout)) {
    const doc = await io.read(`public/assets/layouts/D-CURE.chunks/${cell.id}.glb`);
    const bounds = getBounds(doc.getRoot().listScenes()[0]);
    // Clip aprons close floating-point cracks without raising the playable surface.
    for (const axis of [0, 2]) {
      expect(Math.abs(bounds.min[axis]), `${cell.id} min axis ${axis}`).toBeLessThanOrEqual(.02);
      expect(Math.abs(bounds.max[axis] - 100), `${cell.id} max axis ${axis}`).toBeLessThanOrEqual(.02);
    }
    expect(bounds.min[1]).toBeGreaterThanOrEqual(-.02); expect(bounds.max[1]).toBeLessThanOrEqual(.02);
  }
});
