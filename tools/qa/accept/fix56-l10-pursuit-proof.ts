import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from './evaluate';
import { atomicJson } from './report';
import type { NativeReceipt } from './probe';

const proofPath = 'docs/reports/fix56-c/L10-pursuit.json';
const original = readFileSync(proofPath), proof = JSON.parse(original.toString());
const cases = [];
try {
  for (const tier of ['low', 'high'] as const) {
    const nativePath = `docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`;
    const native = JSON.parse(readFileSync(nativePath, 'utf8')) as NativeReceipt;
    const verdict = () => evaluate(native, nativePath).find(check => check.id === 'L10-07' && check.clause === 'continuous same-ID pursuit without LOS or teleport')?.status;
    assert.equal(verdict(), 'PASS', `${tier}: ordinary contact correction is not a teleport`);
    cases.push({ tier, fault: 'current exact-source receipt', expected: 'PASS', observed: verdict() });
    const broken = structuredClone(proof), row = broken.rows.find((item: { tier: string }) => item.tier === tier);
    row.relocations = [...row.relocations, { tick: 90000, writer: 'mega.rally', metres: 999 }];
    row.maxStepMetres = 999;
    writeFileSync(proofPath, JSON.stringify(broken));
    assert.equal(verdict(), 'FAIL', `${tier}: a scheduled 999m relocation must fail`);
    cases.push({ tier, fault: 'injected scheduled 999m relocation', expected: 'FAIL', observed: verdict() });
  }
} finally {
  writeFileSync(proofPath, original);
}
atomicJson('docs/reports/fix56-c/L10-pursuit-checker-proof.json', {
  sourceHash: proof.sourceHash,
  observerHash: proof.observerHash,
  checkerSha256: createHash('sha256').update(readFileSync('tools/qa/accept/evaluate.ts')).digest('hex'),
  pursuitSha256: createHash('sha256').update(original).digest('hex'),
  contactCorrections: 'Only special.swept-contact moves are treated as physical contact resolution; >1m still fails.',
  cases,
  restoredSha256: createHash('sha256').update(readFileSync(proofPath)).digest('hex'),
});
console.log(`${cases.length} L10-07 pursuit checker controls passed; original exact-source evidence restored`);
