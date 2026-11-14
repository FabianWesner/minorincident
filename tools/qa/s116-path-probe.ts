import { writeFileSync } from 'node:fs';
import { NavGrid } from '../../src/sim/ai/NavGrid';
import { runLevel } from '../sim-runner/levels';
import { L4HoldCensus } from './threat/l4-hold';
import type { SimWorld } from '../../src/sim/world/SimWorld';
const original = NavGrid.prototype.path;
const receipts: unknown[] = [];
for (const quality of ['high', 'low'] as const) {
  let world: SimWorld;
  let census: L4HoldCensus;
  type Request = { actor: number; from: number; to: number; first: number; last: number; calls: number; expansions: number; completed?: number; cancelled?: number; reason?: string };
  const traces: unknown[] = [];
  const requests: Request[] = [], active = new Map<number[], Request>();
  NavGrid.prototype.path = function(from, to, result, budget) {
    const found = original.call(this, from, to, result, budget);
    const actor = world?.infected?.active.find(e => e.infected?.path === result);
    if (!actor || world.missions?.state.l4?.phase !== 'war') return found;
    let request = active.get(result);
    if (request && request.to !== to) { request.cancelled = world.tick; request.reason = 'superseded destination'; active.delete(result); request = undefined; }
    if (!request && this.pending(from, to)) {
      request = { actor: actor.id, from, to, first: world.tick, last: world.tick, calls: 0, expansions: 0 };
      requests.push(request); active.set(result, request);
    }
    if (request) { request.last = world.tick; request.calls++; request.expansions += this.expansions; if (found) { request.completed = world.tick; active.delete(result); } else if (!this.pending(from, to)) { request.cancelled = world.tick; request.reason = 'search exhausted'; active.delete(result); } }
    return found;
  };
  await runLevel('L4', 'complete', 1, 250, 'auto', undefined, undefined, 0, { quality, passive: true, l4Profile: 'idle',
    beforeBegin: w => {
      world = w; census = new L4HoldCensus(w);
      const update = w.update.bind(w);
      w.update = () => {
        update();
        if (w.tick % 60 === 0 && w.tick >= 2820 && w.tick <= 3780) {
          const actor = w.entities.get(quality === 'high' ? 330 : 242);
          if (actor?.infected) {
            const b = actor.infected;
            traces.push({ tick: w.tick, id: actor.id, alive: actor.health.current > 0, x: actor.transform.x, z: actor.transform.z,
              state: b.state, goal: b.goal, pathLength: b.path.length, pathIndex: b.pathIndex, retry: b.pathRetryAt,
              scripted: b.scripted, investigate: b.investigate, approach: b.breachApproach });
          }
        }
        for (const [path, request] of active) {
          const actor = w.entities.get(request.actor);
          if (!actor || actor.health.current <= 0 || actor.hidden || actor.infected?.path !== path) {
            request.cancelled = w.tick; request.reason = 'actor no longer requests navigation'; active.delete(path);
          } else if (actor.infected.goal !== request.to) {
            request.cancelled = w.tick; request.reason = 'cached route goal invalidated'; active.delete(path);
          }
        }
      };
    },
    beforeDispose: () => {
      const mature = requests.filter(r => world.tick - r.first >= 600);
      receipts.push({ quality, traces, census: census.finish(), pendingRequests: requests.length,
        notCompletedWithin10Seconds: mature.filter(r => (r.completed === undefined || r.completed - r.first > 600) && (r.cancelled === undefined || r.cancelled - r.first > 600)),
        actor298: requests.filter(r => r.actor === 298), requests });
    } });
}
NavGrid.prototype.path = original;
writeFileSync('test-results/s116-path-probe.json', JSON.stringify(receipts, null, 2));
