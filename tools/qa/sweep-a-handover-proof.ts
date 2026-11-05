/** Controls for the missing L1-04 visual-review registration. */
import assert from 'node:assert/strict';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { completeNativeRows } from './accept/evaluate';
import { provenance } from './accept/probe';
import { rowResult, sourceRows } from './accept/report';
import type { ReviewDecision } from './accept/reviews';

const source = sourceRows().find(row => row.id === 'L1-04')!;
const path = 'docs/qa/reviews/L1-04.json', saved = readFileSync(path);
const decision = JSON.parse(saved.toString()) as ReviewDecision;
const results: { control: string; detected: boolean }[] = [];
const verdict = () => rowResult(source, []).currentStatus;
const record = (control: string, detected: boolean) => { results.push({ control, detected }); assert(detected, control); };
const rejects = () => { try { verdict(); return false; } catch { return true; } };
try {
  record('fresh exact-clause inspected review qualifies', verdict() === 'PASS');
  const requirements = completeNativeRows.get(source.id)!;
  completeNativeRows.delete(source.id);
  try { record('missing coverage registration cannot qualify', verdict() === 'NOT CHECKED'); }
  finally { completeNativeRows.set(source.id, requirements); }
  unlinkSync(path); record('missing review cannot qualify', verdict() === 'NOT CHECKED');
  const failed = structuredClone(decision); failed.status = 'FAIL'; failed.clauses[0].verdict = 'FAIL';
  writeFileSync(path, JSON.stringify(failed)); record('fresh failed review fails', verdict() === 'FAIL');
  const stale = structuredClone(decision); stale.commit = '0c410e1111f5380e91cb8ca7f2a65b7f4295c003';
  writeFileSync(path, JSON.stringify(stale)); record('stale review cannot qualify', verdict() === 'NOT CHECKED');
  const wrong = structuredClone(decision); wrong.clauses[0].clause = 'Incomplete handover';
  writeFileSync(path, JSON.stringify(wrong)); record('wrong criterion rejected', rejects());
  const corrupt = structuredClone(decision); corrupt.evidence[0].sha256 = '0'.repeat(64);
  writeFileSync(path, JSON.stringify(corrupt)); record('wrong evidence hash rejected', rejects());
} finally { writeFileSync(path, saved); }
writeFileSync('docs/reports/sweep-a/L1-04-qualification-proof.json', JSON.stringify({ ...provenance(), results }, null, 2) + '\n');
console.log(`${results.length} handover qualification controls pass`);
