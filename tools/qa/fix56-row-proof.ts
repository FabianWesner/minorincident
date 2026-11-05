/** Coverage composition controls for the repaired rows; no game mutation. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { completeNativeRows, evaluate, type Clause } from './accept/evaluate';
import { fixtureHash, type FixtureReceipt } from './accept/fixtures';
import { provenance, type NativeReceipt } from './accept/probe';
import { rowResult, sourceRows } from './accept/report';
import type { ReviewDecision } from './accept/reviews';

const identity = provenance(), checks: Clause[] = [], results: { row: string; control: string; detected: boolean }[] = [];
for (const level of ['L1', 'L2']) for (const tier of ['low', 'high']) {
  for (const policy of ['complete', 'stationary']) {
    const path = `docs/reports/fix51-verify/receipts/${level}-${tier}-${policy}.json`;
    const receipt = JSON.parse(readFileSync(path, 'utf8')) as NativeReceipt;
    assert.equal(receipt.sourceHash, identity.sourceHash); assert.equal(receipt.observerHash, identity.observerHash);
    checks.push(...evaluate(receipt, path));
  }
  const fixture = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/${level}-${tier}-fixtures.json`, 'utf8')) as FixtureReceipt;
  assert.equal(fixture.sourceHash, identity.sourceHash); assert.equal(fixture.fixtureHash, fixtureHash());
  assert.deepEqual(fixture.errors, []); checks.push(...fixture.checks);
}
const legacy = execFileSync('git', ['show', '7401ecf40:tools/qa/accept/evaluate.ts'], { encoding: 'utf8' });
for (const row of ['L1-06', 'L2-06', 'L2-11']) {
  const source = sourceRows().find(source => source.id === row)!, clauses = checks.filter(check => check.id === row);
  const verdict = (values = clauses) => rowResult(source, values).currentStatus;
  const record = (control: string, detected: boolean) => { results.push({ row, control, detected }); assert(detected, `${row}: ${control}`); };
  record('both quality tiers and required inspected evidence pass', verdict() === 'PASS');
  record('legacy coverage entry absent despite measured clauses', !legacy.includes(`['${row}',`));
  const required = completeNativeRows.get(row)!;
  completeNativeRows.delete(row);
  try { record('unmapped row cannot qualify', verdict() === 'NOT CHECKED'); }
  finally { completeNativeRows.set(row, required); }
  for (const tier of ['low', 'high']) for (const requirement of required) {
    const omitted = clauses.filter(check => !(check.tier === tier && check.policy === requirement.policy && check.clause === requirement.clause));
    record(`missing ${tier}/${requirement.policy}/${requirement.clause}`, verdict(omitted) === 'NOT CHECKED');
    const bad = structuredClone(clauses), check = bad.find(check => check.tier === tier && check.policy === requirement.policy && check.clause === requirement.clause)!;
    check.status = 'FAIL'; record(`failed native ${tier}/${requirement.clause}`, verdict(bad) === 'FAIL');
  }
  if (row === 'L2-11') continue;
  const path = `docs/qa/reviews/${row}.json`, saved = readFileSync(path);
  try {
    unlinkSync(path); record('missing review cannot qualify', verdict() === 'NOT CHECKED');
    const decision = JSON.parse(saved.toString()) as ReviewDecision;
    const failed = structuredClone(decision); failed.status = 'FAIL'; failed.clauses.forEach(clause => { clause.verdict = 'FAIL'; });
    writeFileSync(path, JSON.stringify(failed)); record('fresh failed visual review fails', verdict() === 'FAIL');
    const stale = structuredClone(decision); stale.commit = execFileSync('git', ['rev-parse', 'b654298af'], { encoding: 'utf8' }).trim();
    writeFileSync(path, JSON.stringify(stale)); record('stale review cannot qualify', verdict() === 'NOT CHECKED');
    const corrupt = structuredClone(decision); corrupt.evidence[0].sha256 = '0'.repeat(64);
    writeFileSync(path, JSON.stringify(corrupt));
    let rejected = false; try { verdict(); } catch { rejected = true; }
    record('wrong evidence SHA-256 rejected', rejected);
  } finally { writeFileSync(path, saved); }
}
writeFileSync('docs/reports/fix56-a/qualification-proof.json', JSON.stringify({ ...identity, results }, null, 2) + '\n');
console.log(`${results.length} coverage/review controls pass`);
