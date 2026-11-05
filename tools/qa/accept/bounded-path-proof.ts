/** Prove why cell-centre distance cannot reject a valid body-clear walk. */
import assert from 'node:assert/strict';
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { PathProbe } from '../threat/observer';
import { provenance } from './probe';
import { atomicJson } from './report';

const identity = provenance(), campaign = preset('L5-default'); campaign.settings.quality = 'low';
const world = await loadLevel('L5', 1, campaign, 0, { quality: 'low' });
let evidence: unknown;
try {
  // Preserve the known native query as an isolated geometry fixture. Actor
  // placement changes must not erase a proof of the observer's former error.
  const entity = structuredClone(world.infected!.active.find(e => e.archetype === 'infected.runner')!);
  Object.assign(entity.transform, { x: -39.0850651911382, z: 29.60308300731574 });
  const player = { transform: { x: -37.64564895629883, z: 48.123600006103516 } };
  const nav = world.infected!.nav.withClearance(world.infected!.nav.clearance), radius = entity.combat?.radius ?? .35;
  const route: number[] = [], from = nav.startCell(entity.transform, radius * .6), to = nav.nearestCell(player.transform.x, player.transform.z);
  assert(nav.path(from, to, route, Infinity));
  const points = [{ x: entity.transform.x, z: entity.transform.z }, ...route.map(cell => ({ x: nav.x(cell), z: nav.z(cell) })), { x: player.transform.x, z: player.transform.z }];
  const length = (path: typeof points) => path.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - path[i].x, point.z - path[i].z), 0);
  const polyline = [points[0]];
  let cursor = 0;
  while (cursor < points.length - 1) {
    let next = Math.min(points.length - 1, cursor + 40);
    while (next > cursor && !nav.visible(points[cursor], points[next], radius)) next--;
    assert(next > cursor, 'each continuous route leg must clear the actual body radius');
    polyline.push(points[next]); cursor = next;
  }
  const direct = Math.hypot(player.transform.x - entity.transform.x, player.transform.z - entity.transform.z), limit = direct * 2.5;
  assert(length(points) > limit, 'reproduce the old cell-centre false failure');
  assert(length(polyline) <= limit, 'a collision-clear walk satisfies the unchanged bound');
  assert(new PathProbe().query(world.infected!.nav, entity, player.transform, 2.5), 'the corrected observer must recognize the proven walk');
  evidence = { sourceNativeCase: { sourceHash: '1a7b3edb1bb5f29c93e4714afa23ca294a801cb230ada8f8bc3432f3f9f39adc', tick: 5619, entity: 276 }, tier: 'low', entity: entity.id, radius, direct, unchangedMaxStretch: 2.5, limit, cellCentreLength: length(points), visiblePolylineLength: length(polyline),
    start: { ...entity.transform }, goal: { ...player.transform }, polyline,
    everyLegBodyClear: polyline.slice(1).every((point, i) => nav.visible(polyline[i], point, radius)),
    oldMetricRejected: true, correctedMetricAccepted: true };
} finally { world.dispose(); }
assert(evidence);
atomicJson('docs/reports/fix51-r2b/bounded-path-proof.json', { ...identity, method: 'Read-only independent grid on current L5 geometry; recorded native query isolated as a reproducible fixture; body-clear40-cell corner cutting as production steer(); all targets unchanged. Long/disconnected detours remain negative fixtures in tools/qa/threat/proof.ts.', evidence });
console.log('Bounded path proof: cell-centre false failure reproduced; continuous body-clear path meets unchanged2.5× bound.');
