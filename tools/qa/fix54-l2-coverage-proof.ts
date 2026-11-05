/** Prove the new roster coverage is required; a visual PASS alone cannot close L2-03. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { rowResult, sourceRows } from './accept/report';
import { provenance } from './accept/probe';
const report = JSON.parse(readFileSync('docs/reports/fix51-verify/L2.json', 'utf8'));
const source = sourceRows().find(row => row.id === 'L2-03')!;
const checks = report.rows.find((row: { id: string }) => row.id === 'L2-03').checks;
const clause = 'native seven-person seated roster and complete exit/control clocks';
const good = rowResult(source, checks);
assert.equal(good.currentStatus, 'PASS');
const missing = rowResult(source, checks.filter((check: { clause: string; tier: string }) => check.clause !== clause || check.tier !== 'high'));
assert.equal(missing.currentStatus, 'NOT CHECKED');
const failed = rowResult(source, checks.map((check: { clause: string; tier: string }) => check.clause === clause && check.tier === 'low' ? { ...check, status: 'FAIL' } : check));
assert.equal(failed.currentStatus, 'FAIL');
writeFileSync('docs/reports/fix54-a/L2-03-coverage-proof.json', JSON.stringify({ ...provenance(),
  method: 'Current actual receipts plus deliberately removed high roster / failing low roster; exact visual review remains unchanged.',
  complete: good.currentStatus, missingHighRoster: missing.currentStatus, failingLowRoster: failed.currentStatus,
}, null, 2) + '\n');
