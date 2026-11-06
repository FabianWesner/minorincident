/** Retain the real ignored-review counterexample; no new acceptance threshold. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { sourceRows, rowResult } from './accept/report';
import { provenance } from './accept/probe';
const source = sourceRows().find(r => r.id === 'L6-06')!;
const before = JSON.parse(readFileSync('docs/reports/sweep-b/review-fail-before.json', 'utf8'));
const after = rowResult(source, []);
assert.equal(before.currentStatus, 'NOT CHECKED'); assert.equal(after.currentStatus, 'FAIL');
writeFileSync('docs/reports/sweep-b/review-fail-proof.json', JSON.stringify({ ...provenance(), before,
  after: { row: after.id, status: after.status, currentStatus: after.currentStatus, reviewDecision: after.reviewDecision },
  reviewSha256: createHash('sha256').update(readFileSync('docs/qa/reviews/L6-06.json')).digest('hex'),
  scope: 'Actual fresh source-bound measured FAIL on plain S row was ignored. Fix honors FAIL only; PASS full-scope requirements and exact criteria remain unchanged.',
}, null, 2) + '\n');
console.log('Actual L6-06 measured FAIL: before NOT CHECKED; after FAIL.');
