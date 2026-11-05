/** Qualification controls for a row registered by sweep-a2; restore review bytes after every fault. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { atomicJson, rowResult, sourceRows, type LevelAcceptance } from './accept/report';
import { provenance } from './accept/probe';
import type { ReviewDecision } from './accept/reviews';
import { completeNativeRows } from './accept/evaluate';

const id = process.argv[2];
const source = sourceRows().find(row => row.id === id);
assert(source, 'Known row required');
const path = `docs/qa/reviews/${id}.json`, original = readFileSync(path);
const decision = JSON.parse(original.toString()) as ReviewDecision;
const report = JSON.parse(readFileSync(`docs/reports/fix51-verify/${source.level}.json`, 'utf8')) as LevelAcceptance;
const scoped = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], 'utf8')) as { sourceHash: string; checks: LevelAcceptance['rows'][number]['checks'] } : null;
if (scoped) assert.equal(scoped.sourceHash, provenance().sourceHash, 'Current-source scoped checks required');
const checks = scoped?.checks ?? report.rows.find(row => row.id === id)!.checks;
const status = (selected = checks) => rowResult(source, selected).status;
const controls: { test: string; pass: boolean }[] = [];
try {
  const freshRow = rowResult(source, checks);
  controls.push({ test: 'fresh exact review consumed', pass: freshRow.status === decision.status && freshRow.reviewDecision?.freshness === 'FRESH' && freshRow.reviewDecision.row === id && freshRow.reviewDecision.status === decision.status });
  renameSync(path, `${path}.control`);
  try { controls.push({ test: 'missing review cannot pass', pass: status() !== 'PASS' }); }
  finally { renameSync(`${path}.control`, path); }
  writeFileSync(path, JSON.stringify({ ...decision, commit: execFileSync('git', ['rev-parse', 'HEAD~100'], { encoding: 'utf8' }).trim() }));
  controls.push({ test: 'stale review cannot pass', pass: status() !== 'PASS' });
  writeFileSync(path, JSON.stringify({ ...decision, status: 'FAIL', clauses: decision.clauses.map(c => ({ ...c, verdict: 'FAIL' })) }));
  controls.push({ test: 'fresh failure fails', pass: status() === 'FAIL' });
  writeFileSync(path, JSON.stringify({ ...decision, clauses: [{ clause: 'Partial criterion', verdict: 'PASS' }] }));
  let partialRejected = false;
  try { partialRejected = status() !== 'PASS'; } catch { partialRejected = true; }
  assert(partialRejected, 'Partial criterion must not clear a whole row');
  controls.push({ test: 'partial criterion rejected', pass: true });
  writeFileSync(path, JSON.stringify({ ...decision, evidence: decision.evidence.map(e => ({ ...e, sha256: '0'.repeat(64) })) }));
  assert.throws(() => status(), /evidence hash mismatch/);
  controls.push({ test: 'corrupt evidence rejected', pass: true });
  writeFileSync(path, original);
  const required = completeNativeRows.get(id) ?? [];
  for (const check of checks.filter(c => required.some(r => r.clause === c.clause && r.policy === c.policy))) {
    controls.push({ test: `missing ${check.tier}/${check.policy}/${check.clause} cannot pass`, pass: status(checks.filter(c => c !== check)) !== 'PASS' });
    controls.push({ test: `failed ${check.tier}/${check.policy}/${check.clause} fails`, pass: status(checks.map(c => c === check ? { ...c, status: 'FAIL' as const } : c)) === 'FAIL' });
  }
} finally { writeFileSync(path, original); }
assert(readFileSync(path).equals(original));
atomicJson(`docs/reports/sweep-a2/${id}-registration-controls.json`, { ...provenance(), controls, pass: controls.every(c => c.pass), originalReviewRestored: true });
assert(controls.every(c => c.pass), JSON.stringify(controls.filter(c => !c.pass)));
console.log(id, controls.length, 'qualification controls pass');
