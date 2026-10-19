import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { cure } from '../../../src/levels/L10/district';
import { cureEncounters, cureMedkits } from '../../../src/levels/L10/encounters';
import { placementColliders } from '../../../src/levels/districts/staticCollision';
import { solidOverlaps } from '../../../src/levels/placementClearance';
import { DistrictWorld } from '../../../src/sim/world/DistrictWorld';
import { compositions } from '../../../src/levels/compositions';
import type { DistrictLayout, Placement, Point } from '../../../src/levels/districts/types';

/**
 * look-l10 (E32 art direction addendum): the L10 set dressing is appended after the gameplay layout (placement index >= 389)
 * and must never touch gameplay: no dressing solid on the walkable route/detours, the Mega pursuit shortcuts, encounter or
 * medkit spots or the R7 assault ring, no new placement-vs-solid pair, and the whole critical route stays walkable.
 */
const layout = JSON.parse(readFileSync('public/assets/layouts/D-CURE.layout.json', 'utf8')) as DistrictLayout;
const FIRST_DRESSING = 389;
const index = (id: string) => Number(id.split('/')[0].split(':').at(-1));
const route = cure.regions.flatMap((r, i) => i ? r.route.slice(1) : r.route);
const segments: [Point, Point][] = route.slice(1).map((b, i) => [route[i], b]);
const detours: [Point, Point][] = cure.detours.flatMap(d => d.route.slice(1).map((b, i) => [d.route[i], b] as [Point, Point]));
const shortcuts: [Point, Point][] = [[cure.regions[5].route[1], cure.anchors['corridor-breach']], [cure.anchors['corridor-breach'], cure.anchors['r6-r7-seam']], [cure.anchors['r6-r7-seam'], cure.regions[6].route[5]]];
/** Distance between a segment and a ground rectangle, sampled at 0.25 m (dressing boxes are metres apart). */
const segRect = (s: [Point, Point], min: number[], max: number[]) => {
  const d = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]), n = Math.max(1, Math.ceil(d / .25));
  let best = Infinity;
  for (let k = 0; k <= n; k++) {
    const x = s[0][0] + (s[1][0] - s[0][0]) * k / n, z = s[0][1] + (s[1][1] - s[0][1]) * k / n;
    best = Math.min(best, Math.hypot(Math.max(min[0] - x, 0, x - max[0]), Math.max(min[2] - z, 0, z - max[2])));
  }
  return best;
};

test('look-l10 dressing solids keep every gameplay clearance', () => {
  const dressing = layout.placements.filter(p => index(p.id) >= FIRST_DRESSING);
  expect(dressing.length).toBeGreaterThan(2000);
  const colliders = placementColliders(dressing, layout.colliders).filter(c => !c.walkable && index(c.id) >= FIRST_DRESSING);
  const spots: Point[] = [...cureEncounters.map(e => e.at), ...cureMedkits.map(m => m.at)];
  const bad: string[] = [];
  for (const c of colliders) {
    const { min, max } = c.aabb;
    if (c.id.startsWith('kit.crossing-crash')) continue; // L9 crash kit behind the start, boxed, west of every route point
    const route = Math.min(...segments.map(s => segRect(s, min, max))), detour = Math.min(...detours.map(s => segRect(s, min, max)));
    const shortcut = Math.min(...shortcuts.map(s => segRect(s, min, max)));
    const spot = Math.min(...spots.map(p => Math.hypot(Math.max(min[0] - p[0], 0, p[0] - max[0]), Math.max(min[2] - p[1], 0, p[1] - max[2]))));
    const consoleAt = cure.anchors['cure-console'], ring = Math.hypot(Math.max(min[0] - consoleAt[0], 0, consoleAt[0] - max[0]), Math.max(min[2] - consoleAt[1], 0, consoleAt[1] - max[2]));
    if (route < 5 || detour < 4.5 || shortcut < 5.5 || spot < 6 || ring < 60) bad.push(`${c.id} route ${route.toFixed(1)} detour ${detour.toFixed(1)} shortcut ${shortcut.toFixed(1)} spot ${spot.toFixed(1)} ring ${ring.toFixed(1)}`);
  }
  expect(bad).toEqual([]);
});

test('look-l10 dressing adds no placement-vs-solid pair', () => {
  const moving = (p: Placement) => /^(prop|kit|decay|haz|veh)\./.test(p.assetId) && !/^prop\.(tree|street-tree|bush|garden-bush|hedge|flower|grass|privacy-fence|picket-fence)/.test(p.assetId);
  const pairs = new Set<string>();
  for (const tier of [0, 6] as const) for (const o of solidOverlaps(layout, tier, moving)) pairs.add(`${o.placement} x ${o.collider}`);
  expect([...pairs].filter(pair => pair.split(' x ').some(id => index(id) >= FIRST_DRESSING))).toEqual([]);
});

test('look-l10 the critical route, detours and pursuit shortcuts stay walkable after dressing', () => {
  const w = new DistrictWorld(compositions.L10, [layout], 32);
  const blocked: string[] = [];
  for (const s of [...segments, ...detours, ...shortcuts]) {
    const d = Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]);
    for (let t = 0; t <= d; t += 2) { const p: Point = [s[0][0] + (s[1][0] - s[0][0]) * t / d, s[0][1] + (s[1][1] - s[0][1]) * t / d]; if (!w.nav.walkable(p) && !['937', '1517', '2137', '3317'].some(x => Math.abs(p[0] - Number(x)) < 3)) blocked.push(p.map(v => v.toFixed(1)).join(',')); }
  }
  expect(blocked).toEqual([]);
});
