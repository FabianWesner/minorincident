/** Content audit for look-empty; no gameplay fixtures or new test cases. */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { compositions } from '../../src/levels/compositions';
import { levelSevenLayouts } from '../../src/levels/L7/layout';
import { cureRoadsideBelt } from '../../src/levels/L10/roadsideBelt';
import { cure } from '../../src/levels/L10/district';
import { DistrictWorld } from '../../src/sim/world/DistrictWorld';
import { placementColliders } from '../../src/levels/districts/staticCollision';
import type { DistrictLayout, Point } from '../../src/levels/districts/types';
import { subwayAccents } from '../../src/render/NightAccents';

const layout = (id: string) => JSON.parse(readFileSync(`public/assets/layouts/${id}.layout.json`, 'utf8')) as DistrictLayout;
const fair = levelSevenLayouts([layout('D-FAIR')])[0];
const world = new DistrictWorld(compositions.L7, [fair], 32);
const l7 = world.districts[0].decay.placements.filter(p => p.id.startsWith('decor-l7-northgate-'));
const subway = new DistrictWorld(compositions.L6, [layout('D-SUBWAY')], 32);
const l6 = subwayAccents().points.filter(a => a.kind === 'storm-lantern' && a.x > 250);
const research = layout('D-CURE'), belt = cureRoadsideBelt(research.placements);
const l10 = belt.filter(p => /^decor-cure-belt-r[67]-/.test(p.id));
const l6Props = subway.districts[0].decay.placements.filter(p => p.id.startsWith('decor-l6-exit-'));
const supportErrors = l7.filter(p => [p.visualAabb.min[0], p.position[0], p.visualAabb.max[0]].some(x => Math.abs(world.groundHeight(x, p.position[2]) - p.position[1]) > .01)).map(p => p.id);
assert.deepEqual(supportErrors, []);
assert.ok(l6.every(a => Math.abs(a.y - .235 - subway.groundHeight(a.x, a.z)) < .01));
const overlaps: string[][] = [];
for (const [props, base, tier] of [[l7, fair, 6], [l10, research, 0], [l6Props, layout('D-SUBWAY'), 0]] as const) {
  assert.deepEqual(placementColliders([...base.placements, ...props], base.colliders), placementColliders(base.placements, base.colliders));
  for (const p of props) for (const c of base.colliders) {
    const a = p.visualAabb, b = c.aabb;
    if (c.minTier > tier || c.maxTier < tier || b.max[1] <= p.position[1] + .02 || b.min[1] >= a.max[1]) continue;
    if (a.min[0] < b.max[0] && a.max[0] > b.min[0] && a.min[2] < b.max[2] && a.max[2] > b.min[2]) overlaps.push([p.id, c.id]);
  }
}
assert.deepEqual(overlaps, []);
const route = cure.regions[5].route;
let length = 0;
const segments = route.slice(1).map((b, i) => { const a = route[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]), s = length; length += d; return { a, b, d, s }; });
const projection = ([x, z]: Point) => segments.map(q => {
  const ux = (q.b[0] - q.a[0]) / q.d, uz = (q.b[1] - q.a[1]) / q.d;
  const t = Math.max(0, Math.min(q.d, (x - q.a[0]) * ux + (z - q.a[1]) * uz));
  return { at: q.s + t, distance: Math.hypot(x - q.a[0] - ux * t, z - q.a[1] - uz * t) };
}).sort((a, b) => a.distance - b.distance)[0];
const l10Stations = l10.filter(p => p.roadLife && p.id.startsWith('decor-cure-belt-r6-')).map(p => ({ id: p.id, ...projection([p.position[0], p.position[2]]) })).sort((a, b) => a.at - b.at);
const gaps = l10Stations.slice(1).map((p, i) => p.at - l10Stations[i].at);
assert.ok(gaps.every(g => g >= 25 && g <= 40));
const l7Stations = l7.filter(p => p.roadLife).map(p => p.position);
assert.equal(l7Stations.length, 4);
assert.ok(l7Stations.slice(1).every((p, i) => l7Stations[i][0] - p[0] >= 25 && l7Stations[i][0] - p[0] <= 40));
assert.ok(l7Stations.slice(1).every((p, i) => Math.sign(p[2] - 15) !== Math.sign(l7Stations[i][2] - 15)));
assert.ok(l7.every(p => p.visualAabb.max[2] < 10 || p.visualAabb.min[2] > 20));
assert.ok(l10.every(p => p.decor && p.position[1] === 0 && p.position[0] <= 3900));
assert.ok(l6Props.every(p => Math.abs(subway.groundHeight(p.position[0], p.position[2]) - p.position[1]) < .01));
const result = { l6: { pieces: l6Props.length, lights: l6.map(a => ({ x: a.x, z: a.z, base: a.y - .235 })) }, l7: { pieces: l7.length, stations: l7Stations, supportErrors }, l10: { pieces: l10.length, lamps: l10Stations.length, r7Pieces: l10.filter(p => p.id.startsWith('decor-cure-belt-r7-')).length, gapMin: Math.min(...gaps), gapMax: Math.max(...gaps), lastX: Math.max(...l10.map(p => p.position[0])) }, overlaps, collidersUnchanged: true };
mkdirSync('test-results/look-empty', { recursive: true });
writeFileSync('test-results/look-empty/plan.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result));
