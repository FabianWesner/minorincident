/** Reproduce L1's omitted-start-cell false failure without changing the simulation. */
import assert from 'node:assert/strict';
import type { NavGrid } from '../../../src/sim/ai/NavGrid';
import { PathProbe } from '../threat/observer';
import { probeLevel } from './probe';
import { atomicJson } from './report';

type Point = { x: number; z: number };
function walk(nav: NavGrid, start: Point, goal: Point, route: number[], radius: number) {
  const points: Point[] = [{ x: start.x, z: start.z }];
  let cursor = -1, length = 0;
  while (cursor < route.length - 1) {
    let next = Math.min(route.length - 1, cursor + 40);
    while (next > cursor && !nav.visible(points.at(-1)!, { x: nav.x(route[next]), z: nav.z(route[next]) }, radius)) next--;
    if (next <= cursor) return { valid: false, length, points };
    const point = { x: nav.x(route[next]), z: nav.z(route[next]) }, previous = points.at(-1)!;
    length += Math.hypot(point.x - previous.x, point.z - previous.z);
    points.push(point); cursor = next;
  }
  const previous = points.at(-1)!;
  length += Math.hypot(goal.x - previous.x, goal.z - previous.z);
  points.push({ x: goal.x, z: goal.z });
  return { valid: points.slice(1).every((point, i) => nav.visible(points[i], point, radius)), length, points };
}
const query = PathProbe.prototype.query;
let evidence: unknown;
PathProbe.prototype.query = function (source, entity, goal, stretch = Infinity, authored = []) {
  const result = query.call(this, source, entity, goal, stretch, authored);
  if (!evidence && stretch === 2.5 && entity.id === 162 && !authored.length && Math.abs(entity.transform.x - 64.88921792609601) < 1e-8 && Math.abs(entity.transform.z + 10.577819848154727) < 1e-8) {
    const radius = entity.combat!.radius, start = { ...entity.transform };
    const nav = source.withClearance(Math.max(source.clearance, radius)), route: number[] = [];
    const from = nav.startCell(start, radius * .6), to = nav.nearestCell(goal.x, goal.z);
    assert(from >= 0 && to >= 0 && nav.path(from, to, route, Infinity));
    const old = walk(nav, start, goal, route, radius), corrected = walk(nav, start, goal, [from, ...route], radius);
    const limit = Math.hypot(goal.x - start.x, goal.z - start.z) * 2.5;
    assert.equal(old.valid, false, 'the previous observer omits the necessary starting-cell centre');
    assert(corrected.valid && corrected.length <= limit, 'every leg must clear the unchanged actual radius within the unchanged 2.5x limit');
    assert(result, 'production observer must accept the independently proven route');
    evidence = { entity: entity.id, start, goal: { ...goal }, radius, clearance: nav.clearance, limit, old, corrected, observerAccepted: result };
  }
  return result;
};
try {
  const receipt = await probeLevel('L1', 'high', 'complete');
  assert.equal(receipt.error, null); assert(evidence, 'known native query must be observed');
  assert.equal(receipt.nativeStateHash, 'deb3bfd1', 'read-only observation must retain the baseline native state');
  atomicJson('docs/reports/fix51-r4/start-cell-proof.json', { sourceHash: receipt.sourceHash, observerHash: receipt.observerHash, nativeStateHash: receipt.nativeStateHash, method: 'Current high-tier native L1; identical native final state; independent body-clear polyline, original radius and 2.5x bound.', evidence });
  console.log('PASS: omitted-start-cell false failure reproduced; corrected path is body-clear; native state unchanged.');
} finally { PathProbe.prototype.query = query; }
