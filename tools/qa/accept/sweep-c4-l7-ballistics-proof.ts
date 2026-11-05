import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { fix55RocketReceipts } from './fix55-rocket-receipts';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

const path = 'docs/reports/sweep-c4/L7-03-ballistics.json', original = readFileSync(path);
const identity = provenance(), hash = browserHash();
const checks = () => fix55RocketReceipts(identity.sourceHash, hash).flatMap(row => row.receipt.checks);
assert(checks().every(check => check.status === 'PASS'));
const results = [];
try {
  for (const fault of ['missed-first-body', 'wrong-direction-range', 'pointer-instead-of-space', 'missing-high-range']) {
    const proof = JSON.parse(original.toString());
    const kind = fault === 'missed-first-body' ? 'first-hit' : 'direction-range';
    const row = proof.rows.find((row: { tier: string; kind: string }) => row.tier === 'low' && row.kind === kind);
    if (fault === 'missing-high-range') proof.rows = proof.rows.filter((row: { tier: string; kind: string }) => row.tier !== 'high' || row.kind !== 'direction-range');
    else if (fault === 'pointer-instead-of-space') for (const input of row.result.inputs) input.activeAttack = false;
    else row.result.events.find((event: { type: string }) => event.type === 'explosion').position.x += 10;
    writeFileSync(path, JSON.stringify(proof));
    const measured = checks(), failed = measured.filter(check => check.status === 'FAIL');
    const rejected = fault === 'missing-high-range' ? !measured.some(check => check.tier === 'high' && check.clause === 'physical rocket catalog max-range detonation') : failed.length > 0;
    assert(rejected, fault); results.push({ fault, rejected, failedClauses: failed.map(check => check.clause) });
  }
} finally { writeFileSync(path, original); checks(); }
assert(readFileSync(path).equals(original));
atomicJson('docs/reports/sweep-c4/L7-03-ballistics-fault-proof.json', { ...identity, results });
