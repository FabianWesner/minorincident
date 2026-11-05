/** Read-only L5 companion trajectories on the ordinary native complete route.
 * Physical input/browser routes qualify presentation separately. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { SimPhase } from '../../src/core/EventBus';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { provenance } from './accept/probe';

const out = 'docs/reports/sweep-b/corgi'; mkdirSync(out, { recursive: true });
const identity = provenance(), results = [];
for (const tier of ['low', 'high'] as const) {
  const save = preset('L5-default'); save.settings.quality = tier;
  const trace: { tick: number; state: string; player: { x: number; z: number }; dog: { x: number; z: number }; distance: number }[] = [];
  let nativeStateHash = '';
  const run = await runLevel('L5', 'complete', 1, undefined, 'auto', save, undefined, 0, {
    quality: tier,
    beforeBegin: world => world.events.on('sim.tick', () => {
      if (world.tick % 30) return;
      const p = world.entities.get(1)!, e = [...world.entities.iterate()].find(e => e.companion)!;
      trace.push({ tick: world.tick, state: e.companion!.state, player: { x: p.transform.x, z: p.transform.z },
        dog: { x: e.transform.x, z: e.transform.z }, distance: Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) });
    }, SimPhase.cleanup + 1),
    beforeDispose: world => { nativeStateHash = stateHash(world.getState()); },
  });
  const file = `${out}/native-${tier}-trace.json.gz`, bytes = gzipSync(JSON.stringify(trace)); writeFileSync(file, bytes);
  const opening = trace.filter(r => r.tick <= 180 * 60);
  let above10 = 0, longestAbove10 = 0;
  for (const row of trace) { above10 = row.distance > 10 ? above10 + 1 : 0; longestAbove10 = Math.max(longestAbove10, above10); }
  results.push({ tier, run, nativeStateHash, samples: trace.length, within6mShare: trace.filter(r => r.distance <= 6).length / trace.length,
    first180SecondsWithin6mShare: opening.filter(r => r.distance <= 6).length / opening.length,
    maxSeparationM: Math.max(...trace.map(r => r.distance)), longestAbove10mS: longestAbove10 * .5,
    trace: file, traceSha256: createHash('sha256').update(bytes).digest('hex') });
  console.log(JSON.stringify(results.at(-1)));
}
const tool = 'tools/qa/sweep-b-corgi-routes.ts';
writeFileSync(`${out}/native-routes.json`, JSON.stringify({ ...identity, tool,
  toolSha256: createHash('sha256').update(readFileSync(tool)).digest('hex'),
  method: 'Seed1 ordinary complete bot; no actor, AI, loadout, timer or input mutation; post-commit samples every30ticks. Compare final native state hashes with the canonical qa:accept complete receipts.', results }, null, 2) + '\n');
