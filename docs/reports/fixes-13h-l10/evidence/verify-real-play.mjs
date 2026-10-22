/** Re-run after the paired --timing --real-time capture batches. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
const root = process.argv[2] ?? 'test-results/fixes-13h-l10/real-time-matrix';
const tiers = process.argv.includes('--low-only') ? ['low'] : ['low', 'high'];
const summary = [];
for (const backend of ['webgl2', 'webgpu']) for (const tier of tiers) {
  const [before, after] = ['before', 'after'].map(stage => JSON.parse(readFileSync(`${root}/${backend}-${stage}-${tier}/evidence.json`)));
  assert.deepEqual(after.inputs, before.inputs, `${backend}/${tier} ordinary input ledger`);
  assert.deepEqual(after.kills, before.kills, `${backend}/${tier} actual kill events`);
  assert.deepEqual(after.bodies, before.bodies, `${backend}/${tier} permanent body IDs and transforms`);
  for (const result of [before, after]) {
    assert.equal(result.bodies.length, result.kills.length);
    assert.deepEqual(result.errors, []);
    assert.equal(result.nativePerformance.fromTick, 1);
    assert.equal(result.nativePerformance.toTick, 5551);
    assert.ok(result.nativePerformance.frames > 5000);
    assert.deepEqual(result.captures.map(c => c.zoom), [.5, 1, 1.5]);
    for (const c of result.captures) {
      assert.equal(c.state.backend, backend === 'webgl2' ? 'webgl' : 'webgpu');
      assert.equal(c.state.quality, tier);
      assert.ok(Math.abs(c.state.camera.zoom - c.zoom) < .001);
      assert.equal(c.state.corpses, result.bodies.length);
    }
  }
  assert.deepEqual(after.captures.map(c => c.state), before.captures.map(c => c.state), `${backend}/${tier} actual gameplay cameras and lighting`);
  assert.equal(after.pages.reduce((sum, p) => sum + p.instances, 0), after.bodies.length);
  for (const page of after.pages) { assert.match(page.name, /:death-(back|front):0[/]/); assert.equal(page.order, -1); }
  assert.ok(after.nativePerformance.max <= 200, `${backend}/${tier} real assault maximum`);
  const steady = result => result.captures.find(c => c.zoom === 1).samples.map(s => s.p95);
  summary.push({ backend, tier, kills: after.kills.length, before: before.nativePerformance, after: after.nativePerformance, settledBefore: steady(before), settledAfter: steady(after) });
}
console.log(JSON.stringify(summary, null, 2));
writeFileSync(`${root}/audit.json`, JSON.stringify(summary, null, 2));
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
for (const row of summary.filter(r => r.tier === 'low')) {
  assert.ok(row.after.p95 <= row.before.p95 + .0001, `${row.backend} L10 low real-assault p95 must not regress`);
  assert.ok(median(row.settledAfter) <= median(row.settledBefore) + .0001, `${row.backend} L10 low settled-view p95 must not regress`);
}
