/** Receipt for the resident-census correction: prepared encounters precede the spawn observer. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { evaluate } from './evaluate';
import type { NativeReceipt } from './probe';
import { atomicJson } from './report';

const results = ['low', 'high'].map(tier => {
  const path = `docs/reports/fix51-verify/receipts/L7-${tier}-complete.json`;
  const bytes = readFileSync(path), receipt = JSON.parse(bytes.toString()) as NativeReceipt;
  const initial = receipt.observation!.initial!;
  assert.equal(initial.l7!.started, false, 'opening encounters precede the rocket/start admissions');
  const residentIds = initial.census.filter(e => e.infected && e.hp > 0 && e.archetype === 'infected.runner').map(e => e.id);
  const floor = tier === 'low' ? 200 : 400;
  const observed = receipt.observation!.births['infected.runner'];
  assert(observed < floor, 'old post-observer-only count reproduces the false failure');
  assert.equal(residentIds.length + observed, floor, 'initial residents plus later births meet the unchanged floor');
  const find = (r: NativeReceipt) => evaluate(r, path).find(c => c.id === 'L7-04' && c.clause === 'actual resident and later regular admissions')!;
  assert.equal(find(receipt).status, 'PASS');
  const broken = structuredClone(receipt); broken.observation!.births['infected.runner']!--;
  assert.equal(find(broken).status, 'FAIL', 'one missing admission must remain red');
  const residentAlphas = initial.census.filter(e => e.infected && e.hp > 0 && e.archetype === 'infected.alpha').map(e => e.id);
  const laterAlphas = receipt.observation!.births['infected.alpha'];
  assert.equal(residentAlphas.length + laterAlphas, 5, 'the authored five Alphas include prepared residents');
  const alphaCheck = (r: NativeReceipt) => evaluate(r, path).find(c => c.id === 'L7-04' && c.clause === 'actual resident and later Alpha admissions')!;
  assert.equal(alphaCheck(receipt).status, 'PASS');
  const missingAlpha = structuredClone(receipt); missingAlpha.observation!.births['infected.alpha']! -= 2;
  assert.equal(alphaCheck(missingAlpha).status, 'FAIL', 'three Alphas must fail the unchanged four-to-six band');
  return { tier, path, receiptSha256: createHash('sha256').update(bytes).digest('hex'), sourceHash: receipt.sourceHash,
    completed: receipt.run!.completed, initialTick: initial.tick, residentIds, laterBirthTransactions: observed,
    oldCount: observed, correctedCount: residentIds.length + observed, unchangedFloor: floor, missingOneDetected: true, residentAlphas, laterAlphas, unchangedAlphaBand: [4, 6], belowAlphaFloorDetected: true };
});
atomicJson('docs/reports/fix51-r2b/l7-admissions-proof.json', { method: 'runLevel prepares L7 before beforeBegin; observer captures residents before first update and counts subsequent spawn calls', results });
console.log('L7 resident census proof: both tiers pass; one missing admission fails.');
