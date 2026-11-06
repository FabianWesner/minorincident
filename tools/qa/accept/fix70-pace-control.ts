/** Prove that omitting unused extra-seed path diagnostics preserves pace and native state. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { extraFollowerPaceSeeds } from '../threat/followerPaceSeeds';
import { provenance, type NativeReceipt } from './probe';
import { atomicJson } from './report';

const identity = provenance(), controls: object[] = [];
for (const level of ['L5', 'L7'] as const) for (const tier of ['low', 'high'] as const) {
  const path = `docs/reports/fix70-s/before/${level}-${tier}-full-observer.json.gz`;
  const prior = JSON.parse(gunzipSync(readFileSync(path)).toString()) as NativeReceipt;
  assert.equal(prior.sourceHash, identity.sourceHash);
  for (const row of await extraFollowerPaceSeeds(level, tier)) {
    const full = prior.followerPaceSeeds!.find(s => s.seed === row.seed)!;
    const phases = full.phases.map(({ key, followerSpeeds, followerMedian }) => ({ key, followerSpeeds, followerMedian }));
    assert.equal(row.nativeStateHash, full.nativeStateHash); assert.deepEqual(row.phases, phases); assert.equal(row.valid, full.valid);
    controls.push({ level, tier, seed: row.seed, policy: 'complete', identical: true, nativeStateHash: row.nativeStateHash, fullObserverReceipt: path });
  }
}
// Compare the isolated passive seed with the retained full-window serial control.
const baselinePath = 'docs/reports/fix70-s/pace-controls-serial.json';
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
assert.equal(baseline.sourceHash, identity.sourceHash);
const full = baseline.controls.at(-1).fullAndPaceOnly[0];
const passive = await extraFollowerPaceSeeds('L5', 'low', true);
const isolated = passive.find(row => row.seed === 2)!;
assert.deepEqual({ phases: isolated.phases, hash: isolated.nativeStateHash, outcome: isolated.outcome, time: isolated.time }, full);
controls.push({ level: 'L5', tier: 'low', seed: 2, policy: 'passive', identical: true, baselinePath, nativeStateHash: isolated.nativeStateHash, time: isolated.time });
atomicJson('docs/reports/fix70-s/pace-controls.json', { ...identity, controls });
console.log('[fix70-pace-control] eight complete seed controls and one full-window passive control identical');
