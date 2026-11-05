import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { evaluate } from './evaluate';
import { atomicJson, rowResult, sourceRows } from './report';
import { provenance, type NativeReceipt } from './probe';

const identity = provenance(), source = sourceRows().find(row => row.id === 'L10-03')!;
const native = ['low', 'high'].map(tier => {
  const path = `docs/reports/fix51-verify/receipts/L10-${tier}-complete.json`;
  const receipt = JSON.parse(readFileSync(path, 'utf8')) as NativeReceipt;
  assert.equal(receipt.sourceHash, identity.sourceHash);
  return { path, receipt };
});
const dogPath = 'docs/reports/fix51-verify/receipts/L10-fringe-dogs.json', original = readFileSync(dogPath);
const cases: { tier: string; clause: string; fault: string; observed: string }[] = [];
const check = (item: typeof native[number], receipt: NativeReceipt, clause: string) => evaluate(receipt, item.path).find(row => row.id === 'L10-03' && row.clause === clause)!;
const all = () => native.flatMap(item => evaluate(item.receipt, item.path).filter(row => row.id === 'L10-03'));
assert.equal(rowResult(source, all()).currentStatus, 'PASS');
try {
  for (const item of native) {
    const low = item.receipt.tier === 'low';
    const range = (region: string, field: 'regularPeak' | 'normalPeak' | 'dogPeak' | 'alphaPeak', clause: string, min: number, max: number) => {
      assert.equal(check(item, item.receipt, clause).status, 'PASS');
      for (const value of [min - 1, max + 1]) {
        const receipt = structuredClone(item.receipt);
        receipt.observation!.regions[region][field] = value;
        const result = check(item, receipt, clause);
        assert.equal(result.status, 'FAIL', `${item.receipt.tier} ${clause} ${value}`);
        cases.push({ tier: item.receipt.tier, clause, fault: `${field}=${value}`, observed: result.status });
      }
    };
    // Independent limits from the complete L10-03 criterion, including R2's
    // human range plus dogs and the later regions' combined local census.
    for (const [region, min, max] of [
      ['residential-fringe', low ? 8 : 12, low ? 16 : 24], ['industrial-area', low ? 16 : 25, low ? 28 : 45],
      ['military-zone', low ? 28 : 45, low ? 45 : 75], ['research-campus', low ? 35 : 55, low ? 55 : 85],
      ['destroyed-corridor', low ? 50 : 80, low ? 75 : 130], ['dispersal-complex', low ? 75 : 140, low ? 95 : 190],
    ] as const) range(region, region === 'residential-fringe' ? 'regularPeak' : 'normalPeak', `${region} normal local concurrent peak bound`, min, max);
    for (const region of ['residential-fringe', 'industrial-area', 'military-zone', 'research-campus', 'destroyed-corridor']) {
      range(region, 'dogPeak', `${region} concurrent dog peak`, region === 'residential-fringe' ? 1 : region === 'destroyed-corridor' ? 3 : 2, region === 'residential-fringe' ? 2 : region === 'destroyed-corridor' ? 5 : 4);
      if (region !== 'residential-fringe') range(region, 'alphaPeak', `${region} concurrent Alpha peak`, region === 'destroyed-corridor' ? 2 : 1, region === 'industrial-area' ? 1 : region === 'destroyed-corridor' ? 3 : 2);
    }
    for (const [region, groups, min, max] of [
      ['military-zone', ['military-breach', 'military-column', 'military-exit'], 10, 20],
      ['destroyed-corridor', ['corridor-line', 'corridor-breach', 'corridor-exit'], 20, 35],
    ] as const) for (const group of groups) {
      const clause = `${group} regular group size`;
      assert.equal(check(item, item.receipt, clause).status, 'PASS');
      for (const value of [min - 1, max + 1]) {
        const receipt = structuredClone(item.receipt);
        receipt.observation!.regions[region].regularGroupPeaks[group] = value;
        const result = check(item, receipt, clause);
        assert.equal(result.status, 'FAIL');
        cases.push({ tier: item.receipt.tier, clause, fault: `group=${value}`, observed: result.status });
      }
    }
    for (const fault of ['before pickup', 'premature tick', 'missing admitted dog']) {
      const proof = JSON.parse(original.toString());
      const row = proof.rows.find((row: { tier: string }) => row.tier === item.receipt.tier);
      if (fault === 'before pickup') row.firstDogTick = row.pickupTick - 1;
      if (fault === 'premature tick') row.prematureTicks = 1;
      if (fault === 'missing admitted dog') row.firstDogTick = null;
      writeFileSync(dogPath, JSON.stringify(proof));
      const clause = 'residential dogs follow actual handgun pickup', result = check(item, item.receipt, clause);
      assert.notEqual(result.status, 'PASS');
      cases.push({ tier: item.receipt.tier, clause, fault, observed: result.status });
      writeFileSync(dogPath, original);
    }
  }
  assert.equal(rowResult(source, evaluate(native[0].receipt, native[0].path)).currentStatus, 'NOT CHECKED', 'one quality cannot qualify the whole row');
} finally {
  writeFileSync(dogPath, original);
}
assert(readFileSync(dogPath).equals(original));
atomicJson('docs/reports/sweep-c/L10-03-fault-proof.json', { ...identity,
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  control: 'PASS', cases, missingHighTier: 'NOT CHECKED', originalDogProofRestored: true,
  dogProofSha256: createHash('sha256').update(original).digest('hex'),
});
console.log(`${cases.length} count/composition/dog-timing faults rejected; missing high tier stays NOT CHECKED; original proof restored`);
