/** Validate retry aggregation against real native receipts and deliberately corrupted clocks. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { evaluate, type Verdict } from './accept/evaluate';
import type { NativeReceipt } from './accept/probe';
const root = 'docs/reports/r15-qafix';
const load = (tier: string): NativeReceipt => JSON.parse(readFileSync(`${root}/native/receipts/L10-${tier}-complete.json`, 'utf8'));
const low = load('low'), high = load('high');
const rows: { name: string; expected: Verdict; actual: Verdict }[] = [];
const check = (name: string, input: NativeReceipt, expected: Verdict) => {
  const actual = evaluate(input, 'controlled-receipt').find(row => row.id === 'L10-10' && row.clause === 'actual eligible charge ticks and increments')!.status;
  rows.push({ name, expected, actual });
};
check('native low, one completed attempt', low, 'PASS');
check('native high, completed after death retries', high, 'PASS');
for (const [name, patch, expected] of [
  ['missed eligible increment', { incrementTicks: 3599 }, 'FAIL'],
  ['extra increment', { incrementTicks: 3601 }, 'FAIL'],
  ['invalid outside/dead increment', { invalidIncrements: 1 }, 'FAIL'],
  ['charge exceeds cap', { maximum: 3601 }, 'FAIL'],
  ['insufficient eligible time', { eligibleTicks: 3599, incrementTicks: 3599 }, 'FAIL'],
  ['unfinished charge is unqualified', { maximum: 3599 }, 'NOT CHECKED'],
] as const) {
  const input = structuredClone(low);
  Object.assign(input.observation!.charge, patch);
  check(name, input, expected);
}
const passed = rows.every(row => row.actual === row.expected);
writeFileSync(`${root}/charge-verdict-proof.json`, JSON.stringify({ scope: 'QA evaluator only; canonical native receipts remain unchanged', sourceHash: low.sourceHash, evaluatorSha256: createHash('sha256').update(readFileSync('tools/qa/accept/evaluate.ts')).digest('hex'), passed, rows }, null, 2) + '\n');
console.log(JSON.stringify({ passed, rows }));
if (!passed) process.exitCode = 1;
