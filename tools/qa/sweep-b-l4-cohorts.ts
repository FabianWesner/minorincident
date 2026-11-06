/** Actual street-cohort admissions, with canonical final-state equality. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { runLevel } from '../sim-runner/levels';
import { l4Emergence } from '../../src/data/l4';
import { provenance } from './accept/probe';
const rows = [];
for (const tier of ['low', 'high'] as const) {
  const campaign = preset('L4-default'); campaign.settings.quality = tier;
  const admissions: { id: number; tick: number; origin: number; edge: number; x: number; z: number }[] = [];
  let cursor = 0, finalHash = '';
  const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, { quality: tier, beforeBegin: w => {
    w.events.on('sim.tick', () => {
      const s = w.missions!.state.l4!;
      for (const id of s.emergedIds.slice(cursor)) {
        const e = w.entities.get(id)!, origin = s.origin[id];
        if (origin !== undefined && l4Emergence[origin]) admissions.push({ id, tick: w.tick, origin, edge: l4Emergence[origin].edge, x: e.transform.x, z: e.transform.z });
      }
      cursor = s.emergedIds.length;
    }, 8);
  }, beforeDispose: w => { finalHash = stateHash(w.getState()); } });
  const canonical = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L4-${tier}-complete.json`, 'utf8'));
  assert.equal(canonical.sourceHash, provenance().sourceHash); assert.equal(finalHash, canonical.nativeStateHash);
  const cohorts = [...new Set(admissions.map(e => `${e.tick}:${e.origin}`))].map(key => ({ key, actors: admissions.filter(e => `${e.tick}:${e.origin}` === key) }));
  rows.push({ tier, run, finalHash, canonicalHash: canonical.nativeStateHash, cohorts, smallest: Math.min(...cohorts.map(c => c.actors.length)), largest: Math.max(...cohorts.map(c => c.actors.length)) });
  console.log(tier, rows.at(-1)!.smallest, rows.at(-1)!.largest);
}
writeFileSync('docs/reports/sweep-b/L4-cohorts.json', JSON.stringify({ ...provenance(), producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-cohorts.ts')).digest('hex'), method: 'Every-tick newly appended emergedIds, actual production origin/edge and admitted actor coordinates. A cohort is the production same-tick same-origin street admission transaction, not a distance threshold. Actual native complete route, no protection; read-only observer must preserve both canonical final hashes.', rows }, null, 2) + '\n');
