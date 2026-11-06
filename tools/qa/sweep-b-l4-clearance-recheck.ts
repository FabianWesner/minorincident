/** Current-source both-tier check of every L4 tank impact's actor clearance. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { provenance } from './accept/probe';

const identity = provenance();
const ledgerPath = 'docs/reports/sweep-b/L4-tank-clearance.json.gz';
const ledger = JSON.parse(gunzipSync(readFileSync(ledgerPath), 'utf8'));
assert.equal(ledger.sourceHash, identity.sourceHash, 'tank ledger must match current source');
const rows = ledger.rows.map((row: any) => {
  assert.equal(row.finalHash, row.canonicalHash, `${row.tier}: mortal complete state matches canonical`);
  const war = row.shots.filter((shot: any) => shot.phase === 'war');
  const forced = row.shots.find((shot: any) => shot.phase === 'collapse');
  assert.ok(war.length && forced, `${row.tier}: retain ordinary and forced tank shots`);
  const distances = row.shots.flatMap((shot: any) => shot.protected.map((actor: any) => actor.distance));
  assert.ok(distances.every((distance: number) => distance >= 15), `${row.tier}: every shot clears every registered live actor by15m`);
  const intervals = war.slice(1).map((shot: any, i: number) => (shot.tick - war[i].tick) / 60);
  assert.ok(intervals.every((seconds: number) => seconds >= 8 && seconds <= 12), `${row.tier}: ordinary tank cadence stays within8–12s`);
  return { tier: row.tier, finalHash: row.finalHash, canonicalHash: row.canonicalHash, shots: row.shots.length,
    warShots: war.length, forcedTarget: forced.to, forcedMinClearance: Math.min(...forced.protected.map((actor: any) => actor.distance)),
    ordinaryMinClearance: Math.min(...war.flatMap((shot: any) => shot.protected.map((actor: any) => actor.distance))), intervals };
});
const proof = { row: 'L4-10', status: 'NOT CHECKED', sourceHash: identity.sourceHash,
  producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-clearance-recheck.ts')).digest('hex'),
  ledger: ledgerPath, ledgerSha256: createHash('sha256').update(readFileSync(ledgerPath)).digest('hex'),
  observation: 'Current-source native L4 complete routes at both tiers preserve canonical hashes. Every ordinary and forced tank impact clears every registered living player/ally by at least15m; ordinary 8–12s cadence remains within bounds. The fuel-truck move resolves the measured clearance defect. Current-source renderer review of the moved truck and blast scene could not be captured because sandbox networking denied Vite bind with EPERM; full row remains NOT CHECKED.', rows };
writeFileSync('docs/reports/sweep-b/L4-10-clearance-recheck.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(rows));
