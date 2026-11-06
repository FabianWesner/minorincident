/** Current-source both-tier recheck of L4 frontal riot MG TTK and survival. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { provenance } from './accept/probe';

const identity = provenance(), ledgerPath = 'docs/reports/sweep-b/L4-riot-duels.json';
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));
assert.equal(ledger.sourceHash, identity.sourceHash, 'duel ledger must match current source');
const rows = ledger.rows.map((row: any) => {
  const firstHit = row.hits[0]?.tick, killTick = Math.round(row.seconds * 60);
  const firstHitToKill = firstHit === undefined ? null : (killTick - firstHit) / 60;
  assert.equal(row.riotHp, 0, `${row.tier} ${row.startDistance}m riot is incapacitated`);
  assert.equal(row.playerHp > 0, true, `${row.tier} ${row.startDistance}m full-health courier survives`);
  if (row.startDistance >= 1.6) {
    assert.ok(row.seconds <= 6, `${row.tier} ${row.startDistance}m duel finishes within6s`);
    assert.ok(firstHitToKill! <= 6, `${row.tier} ${row.startDistance}m first-hit TTK stays within6s`);
  }
  return { tier: row.tier, distance: row.startDistance, seconds: row.seconds, firstHitToKill,
    playerHp: row.playerHp, riotHp: row.riotHp, hitCount: row.hits.length };
});
const proof = { row: 'L4-11', status: 'NOT CHECKED', sourceHash: identity.sourceHash,
  producerSha256: createHash('sha256').update(readFileSync('tools/qa/sweep-b-l4-riot-recheck.ts')).digest('hex'),
  ledger: ledgerPath, ledgerSha256: createHash('sha256').update(readFileSync(ledgerPath)).digest('hex'),
  observation: 'Current-source production combat at both tiers: the full-health courier survives every isolated MG duel and the riot is incapacitated within6s at every measured distance from1.6m through26m. Current MG spread and riot shield strain solve the long-range TTK counterexample. Visible chip/recoil, always-shown bar, flank coverage, and the PO feel question still need current-source renderer review.', rows };
writeFileSync('docs/reports/sweep-b/L4-11-recheck.json', JSON.stringify(proof, null, 2) + '\n');
console.log(JSON.stringify(rows));
