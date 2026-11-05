/** Demonstrate that the exact L3 fallback observer rejects an early fallback. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { batteryFixtures } from './battery-fixtures';
import { fixtureHash } from './fixtures';
import { l3 } from '../../../src/data/l3';
import { provenance } from './probe';
import { atomicJson } from './report';

type Check = { id: string; clause: string; value: unknown; target: string; status: 'PASS' | 'FAIL' | 'NOT CHECKED' };
const identity = provenance(), fallback = l3.attack.fallback as { inside: number }, original = fallback.inside;
const rows: { variant: string; check: Check; controlReportSha256: string | null }[] = [];
const old = JSON.parse(readFileSync('docs/reports/fix51-verify/receipts/L3-high-fixtures.json', 'utf8')) as { observations: Record<string, { report: unknown }> };
try {
  for (const variant of ['control', 'inside-threshold-broken-to-seven']) {
    fallback.inside = variant === 'control' ? original : 7;
    const checks: Check[] = [], observations: Record<string, unknown> = {};
    await batteryFixtures('L3', 'high', (id, clause, value, target, pass) => {
      checks.push({ id, clause, value, target, status: pass === undefined ? 'NOT CHECKED' : pass ? 'PASS' : 'FAIL' });
    }, observations);
    const check = checks.find(check => check.clause === 'exact first-of fallback boundary and cause');
    assert(check); assert.equal(check.status, variant === 'control' ? 'PASS' : 'FAIL');
    let controlReportSha256: string | null = null;
    if (variant === 'control') {
      const report = (observations['L3/idle'] as { report: unknown }).report;
      assert.deepEqual(report, old.observations['L3/idle'].report, 'read-only boundary observation must preserve the actual mortal idle report');
      controlReportSha256 = createHash('sha256').update(JSON.stringify(report)).digest('hex');
    }
    rows.push({ variant, check, controlReportSha256 });
    console.log(JSON.stringify(rows.at(-1)));
    atomicJson('docs/reports/fix51-r4/fallback-boundary-proof.json', {
      ...identity, fixtureHash: fixtureHash(),
      method: 'Actual mortal L3 battery at high tier; process-local inside threshold7 counterexample, restored in finally. Acceptance targets remain3/8/60.', rows,
    });
  }
} finally { fallback.inside = original; }
