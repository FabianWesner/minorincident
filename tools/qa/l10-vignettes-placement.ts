/** Actual native L10 assembly: merged farm/vignette overlap and route clearance audit. No browser. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { cure } from '../../src/levels/L10/district';
import { farmLanes } from '../../src/levels/L10/farmLayout';
import { cureVignetteRoutes, cureLineDistance } from '../../src/levels/L10/vignettes';
import type { Placement, Point } from '../../src/levels/districts/types';

function segmentBoxDistance(a: Point, b: Point, p: Placement): number {
  const box = p.visualAabb, lo = [box.min[0], box.min[2]], hi = [box.max[0], box.max[2]];
  let enter = 0, leave = 1;
  for (let axis = 0; axis < 2; axis++) {
    const delta = b[axis] - a[axis];
    if (!delta) { if (a[axis] < lo[axis] || a[axis] > hi[axis]) { enter = 2; break; } }
    else { const t = [(lo[axis] - a[axis]) / delta, (hi[axis] - a[axis]) / delta].sort((x, y) => x - y); enter = Math.max(enter, t[0]); leave = Math.min(leave, t[1]); }
  }
  if (enter <= leave) return 0;
  const pointDistance = (q: Point) => Math.hypot(Math.max(lo[0] - q[0], 0, q[0] - hi[0]), Math.max(lo[1] - q[1], 0, q[1] - hi[1]));
  const corners: Point[] = [[lo[0], lo[1]], [lo[0], hi[1]], [hi[0], lo[1]], [hi[0], hi[1]]];
  return Math.min(pointDistance(a), pointDistance(b), ...corners.map(q => cureLineDistance(q, [a, b])));
}
const world = await loadLevel('L10', 32);
try {
  const district = world.districts!.districts[0], placements = district.layout.placements;
  const vignettes = placements.filter(p => p.id.startsWith('decor-cure-vignette-') || /^decor-cure-cross-.*-(remains|scatter)-/.test(p.id));
  const farm = placements.filter(p => p.assetId === 'veg.corn-block' || p.id.startsWith('decor-cure-farm-'));
  assert(vignettes.length > 400 && farm.length > 100, 'Both merged layers must exist in the native world');
  const overlaps: string[][] = [];
  for (const p of vignettes) for (const q of farm) {
    const a = p.visualAabb, b = q.visualAabb;
    if (a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[2] < b.max[2] && a.max[2] > b.min[2]) overlaps.push([p.id, q.id]);
  }
  assert.deepEqual(overlaps, [], 'Vignette footprints must not overlap corn tiles or farm pieces');
  assert(vignettes.every(p => p.fixed && p.decor), 'Story key pieces must remain fixed');
  const routes = [...cureVignetteRoutes().map(r => r.line), ...cure.detours.map(r => r.route), ...farmLanes];
  let minimumClearance = Infinity;
  const blocked: { id: string; route: number; metres: number }[] = [];
  for (const p of vignettes) for (const [route, line] of routes.entries()) for (let i = 1; i < line.length; i++) {
    const metres = segmentBoxDistance(line[i - 1], line[i], p);
    minimumClearance = Math.min(minimumClearance, metres);
    if (metres < 5.4 - 1e-6) blocked.push({ id: p.id, route, metres });
  }
  assert.deepEqual(blocked, [], 'Roads, crossings, detours and farm mown routes must retain 5.4 m clearance');
  const result = { status: 'PASS', seed: 32, vignettePlacements: vignettes.length, cornTiles: farm.filter(p => p.assetId === 'veg.corn-block').length, farmPieces: farm.filter(p => p.assetId !== 'veg.corn-block').length, overlaps, blocked, minimumClearance, routeLines: routes.length, fixed: true, browsersLaunched: 0 };
  mkdirSync('docs/reports/eg-l10-vignettes/evidence', { recursive: true });
  writeFileSync('docs/reports/eg-l10-vignettes/evidence/merge-placement.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
} finally { world.dispose(); }
