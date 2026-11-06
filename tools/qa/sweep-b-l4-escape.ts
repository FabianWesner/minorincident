/** Read-only L4 collapse admissions, corridor occupancy and live pursuer identities. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { l4 } from '../../src/data/l4';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';
const identity = provenance(), rows = [];
const routeDistance = (p: { x: number; z: number }) => {
  let best = Infinity;
  const r = l4.director.escape.route;
  for (let i = 1; i < r.length; i++) {
    const [ax, az] = r[i - 1], [bx, bz] = r[i], dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.z - az) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(p.x - ax - t * dx, p.z - az - t * dz));
  }
  return best;
};
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const waves: { tick: number; count: number; edges: number[] }[] = [];
  const admissions: unknown[] = [], samples: unknown[] = [], windows: { start: number; until: number }[] = [];
  let previous: { pend: number[]; cursor: number; ids: number; tick: number } | undefined;
  let lastGap = 0, finalHash = '';
  const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: world => {
    world.events.on('l4.wave', e => { if (e.type === 'l4.wave' && world.missions!.state.l4!.phase === 'collapse') waves.push({ tick: e.tick, count: e.count, edges: [...e.edges] }); });
    world.events.on('sim.tick', () => {
      const s = world.missions!.state.l4!, p = world.entities.get(1)!;
      if (s.phase !== 'collapse') return;
      if (s.director.gapUntil && s.director.gapUntil !== lastGap) { lastGap = s.director.gapUntil; windows.push({ start: world.tick, until: lastGap }); }
      if (previous && previous.tick + 1 === world.tick) {
        const demand = [...previous.pend];
        for (const wave of waves.filter(w => w.tick === world.tick)) for (const edge of wave.edges) demand[edge] += wave.count / wave.edges.length;
        const released = demand.map((n, edge) => n - s.pend[edge]);
        const added = s.collapseIds.slice(previous.ids);
        assert.equal(released.reduce((a, b) => a + b, 0), added.length, 'actual pending decrements must equal actual admitted collapse IDs');
        let cursor = 0;
        for (let offset = 0; offset < released.length; offset++) {
          const edge = ((tier === 'low' ? 0 : previous.cursor) + offset) % released.length;
          const ids = added.slice(cursor, cursor + released[edge]); cursor += released[edge];
          if (ids.length) admissions.push({ tick: world.tick, edge, count: ids.length, actors: ids.map(id => {
            const a = world.entities.get(id)!;
            return { id, x: a.transform.x, z: a.transform.z, routeDistance: routeDistance(a.transform), hidden: !!a.hidden, emerging: !!a.emerging, pendingAdmission: !!a.pendingAdmission };
          }) });
        }
      }
      if (world.tick % 30 === 0) {
        const actors = world.infected!.active.filter(a => a.health.current > 0 && !a.hidden && !a.pendingAdmission && !a.corpse).map(a => ({
          id: a.id, x: a.transform.x, z: a.transform.z, routeDistance: routeDistance(a.transform), playerDistance: Math.hypot(a.transform.x - p.transform.x, a.transform.z - p.transform.z),
          state: a.infected!.state, mode: a.infected!.l1?.mode, targetId: a.infected!.targetId, l1TargetId: a.infected!.l1?.targetId, heardTargetId: a.infected!.heardTargetId,
          clearingStreet: !!a.infected!.clearingStreet, scripted: a.infected!.scripted, emerging: !!a.emerging,
        }));
        samples.push({ tick: world.tick, lineBreakAt: s.lineBreakAt, gapUntil: s.director.gapUntil, player: { ...p.transform }, pend: [...s.pend], actors });
      }
      previous = { pend: [...s.pend], cursor: s.collapseEdgeCursor ?? 0, ids: s.collapseIds.length, tick: world.tick };
    }, 8);
  }, beforeDispose: world => { finalHash = stateHash(world.getState()); } });
  const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L4-${tier}-complete.json`, 'utf8'));
  assert.equal(canonical.sourceHash, identity.sourceHash); assert.equal(finalHash, canonical.nativeStateHash);
  rows.push({ tier, run, finalHash, canonicalHash: canonical.nativeStateHash, windows, waves, admissions, samples });
  console.log(tier, run.outcome, finalHash, windows, admissions.length);
}
const output = { ...identity, producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-escape.ts')).digest('hex'),
  method: 'Ordinary mortal native complete routes, read-only observers. Per-edge admissions are actual pending-count decrements after same-tick scheduled demand, mapped to newly appended collapse IDs in the production edge iteration order; conservation asserted every tick. Route occupancy and current chase targets sampled at2Hz. Route distance uses authored centreline, gap7m; near-pursuer exception7m. Both final hashes must equal current canonical controls.', rows };
writeFileSync('docs/reports/sweep-b/L4-escape.json.gz', gzipSync(JSON.stringify(output)));
