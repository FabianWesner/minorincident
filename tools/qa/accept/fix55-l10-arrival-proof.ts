import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from './evaluate';
import { atomicJson } from './report';
import type { NativeReceipt } from './probe';

const path = 'docs/reports/fix51-verify/receipts/L10-hold.json';
const original = readFileSync(path);
const proof = JSON.parse(original.toString());
const cases = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const nativePath = `docs/reports/fix51-verify/receipts/L10-${tier}-stationary.json`;
    const native = JSON.parse(readFileSync(nativePath, 'utf8')) as NativeReceipt;
    for (const [seconds, expected] of [[119.99, 'FAIL'], [120, 'PASS'], [160, 'PASS'], [160.01, 'FAIL'], [null, 'NOT CHECKED']] as const) {
      const changed = structuredClone(proof);
      changed.rows.find((row: { tier: string }) => row.tier === tier).arenaAfterActivationSeconds = seconds;
      writeFileSync(path, JSON.stringify(changed));
      const check = evaluate(native, nativePath).find(check => check.id === 'L10-11' && check.clause === 'Mega arena arrival after charge activation');
      assert(check, 'The fresh full-hold receipt must be admitted');
      assert.equal(check.status, expected);
      cases.push({ tier, seconds, expected, observed: check.status });
    }
  }
} finally {
  writeFileSync(path, original);
}
atomicJson('docs/reports/fix55-c/L10-11-boundaries.json', {
  sourceHash: proof.sourceHash, observerHash: proof.observerHash,
  criterion: 'docs/qa/level-acceptance.md L10-11: 120–160 seconds inclusive, by walking, no relocation',
  cases,
  restoredSha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
});
console.log(`${cases.length} arrival boundary/missing-evidence checks passed; original full-hold proof restored`);
