/** Reuse the existing actual-klaxon evaluator on four current physical routes. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { l4PickupVerdict } from './accept/l4-pickup';
import { provenance } from './accept/probe';
import { browserHash } from './accept/browser';
import type { FixtureReceipt } from './accept/fixtures';
const identity = provenance(), matrix = JSON.parse(readFileSync('test-results/sweep-b/input-L4/matrix.json', 'utf8'));
assert.equal(matrix.sourceHash, identity.sourceHash); assert.equal(matrix.results.length, 4);
const sha = (p: string) => createHash('sha256').update(readFileSync(p)).digest('hex');
const rows = [];
for (const cell of matrix.results) {
  assert.equal(cell.exit, 0);
  const root = `test-results/vqa-1b/${cell.tag}`;
  const input = `${root}/${cell.tag}-acceptance-ledger.json`, ledger = JSON.parse(readFileSync(input, 'utf8'));
  const record = ledger.find((r: { level: string }) => r.level === 'L4');
  const verdict = l4PickupVerdict(record.events); assert.equal(verdict.status, 'PASS');
  const controls = [];
  for (const type of ['l4.gun', 'l4.firstTurn', 'actual-klaxon-start', 'actual-l4-admissions']) {
    const events = structuredClone(record.events); events.find((e: { type: string }) => e.type === type).tick++;
    const result = l4PickupVerdict(events); assert.notEqual(result.status, 'PASS'); controls.push({ fault: `${type} delayed one tick`, status: result.status });
  }
  for (const fault of ['observed tick delayed', 'missing voices', 'missing admissions']) {
    let events = structuredClone(record.events); const alarm = events.find((e: { type: string }) => e.type === 'actual-klaxon-start');
    if (fault === 'observed tick delayed') alarm.observedWorldTick++;
    else if (fault === 'missing voices') alarm.voices = [];
    else events = events.filter((e: { type: string }) => e.type !== 'actual-l4-admissions');
    const result = l4PickupVerdict(events); assert.notEqual(result.status, 'PASS'); controls.push({ fault, status: result.status });
  }
  const archived = `docs/reports/sweep-b/L4-${cell.tier}-z${cell.zoom}-ledger.json.gz`;
  writeFileSync(archived, gzipSync(readFileSync(input), { mtime: 0 } as Parameters<typeof gzipSync>[1]));
  const path = `docs/reports/fix51-verify/receipts/L4-${cell.tier}-webgl2-z${cell.zoom}-browser.json`;
  const receipt: FixtureReceipt & { browserHash: string } = { version: 1, level: 'L4', tier: cell.tier, sourceHash: identity.sourceHash,
    fixtureHash: sha('tools/qa/sweep-b-l4-input-proof.ts'), browserHash: browserHash(), errors: [],
    checks: [{ id: 'L4-03', clause: 'actual MG pickup klaxon and attack start share simulation tick', tier: cell.tier, policy: 'real-input-webgl2', status: verdict.status,
      value: { ...verdict.value as object, zoom: cell.zoom, controls, archived, sha256: sha(archived) }, target: 'actual pickup, gun/turn, live positive-gain klaxon voices and first living admissions share one simulation tick', receipt: path }],
    observations: { source: matrix, scope: 'Protected courier; actual physical full L4 route, no skips; no performance timing. The event/graph ledger establishes same-tick equality, not the stills.' } };
  writeFileSync(path, JSON.stringify(receipt, null, 2) + '\n');
  rows.push({ tier: cell.tier, zoom: cell.zoom, ...verdict, controls, input: archived, sha256: sha(archived) });
}
writeFileSync('docs/reports/sweep-b/L4-03-proof.json', JSON.stringify({ ...identity, browserHash: browserHash(), producerSha256: sha('tools/qa/sweep-b-l4-input-proof.ts'), rows }, null, 2) + '\n');
console.log('Four physical cells PASS; all28 missing/delayed controls reject PASS.');
