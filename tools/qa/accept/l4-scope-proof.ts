/** Re-evaluate all four native L4 routes against the authorized opening scope. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { evaluate } from './evaluate';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';
const identity = provenance(), rows: unknown[] = [];
for (const tier of ['low', 'high']) for (const policy of ['complete', 'stationary']) {
  const path = `docs/reports/fix51-verify/receipts/L4-${tier}-${policy}.json`;
  const receipt = JSON.parse(readFileSync(path, 'utf8')) as NativeReceipt;
  const original = JSON.parse(execFileSync('git', ['show', `524ea45a6:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })) as NativeReceipt;
  assert.equal(receipt.sourceHash, identity.sourceHash); assert.equal(receipt.observerHash, identity.observerHash);
  assert.equal(receipt.nativeStateHash, original.nativeStateHash);
  const combat = receipt.threat!.phases.find(phase => phase.key === 'step/hold')!;
  const openings = Object.values(receipt.observation!.final!.mission.l4!.breaches ?? {}).flatMap(b => b?.openAt ? [b.openAt] : []);
  assert(openings.length); const firstOpening = Math.min(...openings);
  assert(combat.legalPaths!.samples > 0);
  assert(combat.legalPaths!.firstTick >= firstOpening, 'intact-perimeter ticks must not be scored');
  assert(combat.legalPaths!.firstTick < firstOpening + 120, 'score by the next scheduled sample');
  const checks = evaluate(receipt, path).filter(check => check.id === 'L4-07');
  const attacks = (r: NativeReceipt) => evaluate(r, path).filter(check => check.id === 'L4-07' && /windup|first real player attack/.test(check.clause));
  assert.deepEqual(attacks(receipt), attacks(original), 'all attack clauses, values and targets must be unchanged');
  const broken = structuredClone(receipt); broken.threat!.phases.find(p => p.key === 'step/hold')!.boundedPaths!.minimumPercent = 89.99;
  assert.equal(evaluate(broken, path).find(c => c.id === 'L4-07' && c.clause.startsWith('minimum bounded'))!.status, 'FAIL');
  rows.push({ tier, policy, nativeStateHash: receipt.nativeStateHash, firstOpening, scope: combat.legalPaths, bounded: combat.boundedPaths, checks });
}
atomicJson('docs/reports/fix51-r4/l4-scope-proof.json', { ...identity, method: 'Actual native routes under the authorized first-physical-opening scope. Compare attack measurements/criteria and native final state against the initial merged-head receipts; 89.99% fault remains FAIL.', rows });
console.log('PASS: opening scope, unchanged native state and attack clauses; unchanged90percent target rejects89.99.');
