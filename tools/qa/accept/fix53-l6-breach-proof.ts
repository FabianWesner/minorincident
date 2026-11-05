/** Check the retained strict-floor trajectories and reject incomplete breach evidence. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { firstBreachPass, type l6Trajectories } from './fix53-l6-trajectories';
import { provenance } from './probe';

const file = 'docs/reports/fix53-b/L6-trajectories.json';
const source = JSON.parse(readFileSync(file, 'utf8')) as { sourceHash: string; rows: Awaited<ReturnType<typeof l6Trajectories>>[] };
assert.equal(source.sourceHash, provenance().sourceHash);
assert.deepEqual(source.rows.map(row => row.tier), ['low', 'high']);
const controls = [];
for (const row of source.rows) {
  assert(firstBreachPass(row));
  for (const kind of ['missing bang', 'bang under1.5s', 'breach before30s', 'breach after40s', 'fewer than6 floor arrivals', 'incomplete route']) {
    const bad = structuredClone(row), breach = bad.events.find(e => e.type === 'l6.breach1')!, bang = bad.events.find(e => e.type === 'l6.bang' && e.breach === 1)!;
    if (kind === 'missing bang') bad.events = bad.events.filter(e => e !== bang);
    if (kind === 'bang under1.5s') bang.tick = breach.tick - 89;
    if (kind === 'breach before30s') breach.tick = 1799;
    if (kind === 'breach after40s') breach.tick = 2401;
    if (kind === 'fewer than6 floor arrivals') for (const actor of bad.actors.filter(a => a.wave === 1).slice(5)) actor.firstShelterFloor = null;
    if (kind === 'incomplete route') bad.run.completed = false;
    assert.equal(firstBreachPass(bad), false);
    controls.push({ tier: row.tier, kind, result: 'rejected' });
  }
}
const sha = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');
writeFileSync('docs/reports/fix53-b/L6-03-proof.json', JSON.stringify({ sourceHash: source.sourceHash, row: 'L6-03', status: 'PASS',
  method: 'Actual same-ID bodies fit inside authored shelter polygon and have feet within0.1m of its floor height. Every sim tick observed; canonical complete route state identical. Unchanged30–40s, bang≥1.5s, ≥6 actual floor arrivals.',
  file, sha256: sha(file), observerSha256: sha('tools/qa/accept/fix53-l6-trajectories.ts'),
  rows: source.rows.map(row => ({ tier: row.tier, events: row.events, firstWave: row.actors.filter(actor => actor.wave === 1), observedHash: row.observedHash, canonicalHash: row.canonicalHash })), controls }, null, 2) + '\n');
console.log('L6-03 PASS with strict floor height; twelve missing/invalid controls reject PASS.');
