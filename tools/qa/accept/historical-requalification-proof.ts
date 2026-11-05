import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { atomicJson, rowResult, sourceRows, type LevelAcceptance } from './report';
import { latestRelevantCommit, reviewFreshness, type ReviewDecision } from './reviews';

// Exercise the actual six current-source physical L9 route clauses, rather
// than synthetic checks that could omit a required route or quality tier.
const path = 'docs/qa/reviews/L9-03.json';
const original = readFileSync(path);
const decision = JSON.parse(original.toString()) as ReviewDecision;
const report = JSON.parse(readFileSync('docs/reports/fix51-verify/L9.json', 'utf8')) as LevelAcceptance;
const source = sourceRows().find(row => row.id === 'L9-03')!;
const checks = report.rows.find(row => row.id === source.id)!.checks;
assert.equal(source.baseline.status, 'FAIL');
assert.equal(checks.length, 6);
assert(checks.every(check => check.status === 'PASS'));
assert.equal(reviewFreshness(decision, 'L9'), 'FRESH');
const cases: { name: string; status: string; currentStatus: string }[] = [];
const record = (name: string, selected = checks, expected = 'FAIL', current = 'PASS') => {
  const row = rowResult(source, selected);
  assert.equal(row.status, expected, name);
  assert.equal(row.currentStatus, current, name);
  assert.deepEqual(row.historical, source.baseline, 'original failure evidence must remain attributed');
  cases.push({ name, status: row.status, currentStatus: row.currentStatus });
};
try {
  record('six passing routes plus fresh exact full-row review', checks, 'PASS');
  unlinkSync(path);
  record('missing full-row review retains historical failure');
  const stale = structuredClone(decision);
  stale.commit = execFileSync('git', ['rev-parse', `${latestRelevantCommit('L9')}^`], { encoding: 'utf8' }).trim();
  assert.equal(reviewFreshness(stale, 'L9'), 'STALE');
  writeFileSync(path, JSON.stringify(stale));
  record('stale full-row review retains historical failure');
  const partial = structuredClone(decision);
  partial.clauses[0].clause = 'Only one photographed road encounter';
  writeFileSync(path, JSON.stringify(partial));
  record('partial criterion review cannot close whole row');
  writeFileSync(path, original);
  record('missing high-road measurement', checks.filter(check => !(check.tier === 'high' && check.clause === 'road full driving camera visibility')), 'FAIL', 'NOT CHECKED');
  const failed = structuredClone(checks);
  failed[0].status = 'FAIL';
  record('failing route cannot be overridden by review', failed, 'FAIL', 'FAIL');
  const rejected = structuredClone(decision);
  rejected.status = 'FAIL'; rejected.clauses[0].verdict = 'FAIL';
  writeFileSync(path, JSON.stringify(rejected));
  record('fresh failing review keeps failure', checks, 'FAIL', 'FAIL');
  const badHash = structuredClone(decision);
  badHash.evidence[0].sha256 = '0'.repeat(64);
  writeFileSync(path, JSON.stringify(badHash));
  assert.throws(() => rowResult(source, checks), /evidence hash mismatch/);
} finally {
  writeFileSync(path, original);
}
assert(readFileSync(path).equals(original));
atomicJson('docs/reports/sweep-c/historical-requalification-proof.json', {
  sourceHash: report.sourceHash, observerHash: report.observerHash,
  before: 'docs/reports/sweep-c/L9-03-before-requalification.json',
  review: { file: path, sha256: createHash('sha256').update(original).digest('hex') },
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  cases, invalidEvidenceHashRejected: true, originalReviewBytesRestored: true,
});
console.log(cases);
