/** Prove fixed-marker observation is read-only and rejects a courier-relative marker. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { l6MarkerFixture } from './edge-fixtures';
import { provenance } from './probe';
import { atomicJson } from './report';
import { LevelSixSubway } from '../../../src/sim/missions/LevelSixSubway';

type Value = { nativeStateHash: string; trajectory: unknown };
type Row = { tier: string; variant: string; id: string; clause: string; status: string; value: unknown };
const identity = provenance(), rows: Row[] = [];
for (const tier of ['low', 'high'] as const) {
  const observations: Record<string, unknown> = {};
  await l6MarkerFixture(tier, (id, clause, value, _target, pass) => {
    assert.equal(pass, true);
    rows.push({ tier, variant: 'control', id, clause, status: 'PASS', value });
  }, observations);
  const baseline = JSON.parse(readFileSync(`docs/reports/fix51-verify/receipts/L6-${tier}-complete.json`, 'utf8')) as { nativeStateHash: string };
  assert.equal((observations['L6/fixed-markers'] as Value).nativeStateHash, baseline.nativeStateHash);
  console.log(`${tier}: fixed gate branches and unchanged ordinary native state PASS`);
}
// Fault injection stays in this process and is restored even when an assertion fails.
const prototype = LevelSixSubway.prototype as unknown as {
  guide(p: { x: number; z: number }): void;
  s: { phase: string };
  mission: { state: { marker: string | null }; def: { anchors: Record<string, { x: number; z: number }> } };
};
const guide = prototype.guide;
try {
  prototype.guide = function (p) {
    guide.call(this, p);
    if (this.s.phase === 'retreat' && this.mission.state.marker === 'l6-next') {
      this.mission.def.anchors['l6-next'].x = p.x + 12;
      this.mission.def.anchors['l6-next'].z = p.z;
    }
  };
  await l6MarkerFixture('low', (id, clause, value, _target, pass) => {
    assert.equal(pass, false);
    rows.push({ tier: 'low', variant: 'moving-marker-counterexample', id, clause, status: 'FAIL', value });
  }, {});
} finally { prototype.guide = guide; }
atomicJson('docs/reports/fix51-r4/l6-marker-proof.json', { ...identity, rows });
console.log('PASS: moving marker detected; original guide restored.');
