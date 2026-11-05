/** Reproducible L1/L2 receipt integrity audit; other lanes are deliberately outside scope. */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { provenance, type NativeReceipt } from './accept/probe';
import { fixtureHash, type FixtureReceipt } from './accept/fixtures';
import { checkpointHash, type CheckpointReceipt } from './accept/checkpoints';
import { browserHash } from './accept/browser';
import { atomicJson, type LevelAcceptance } from './accept/report';

const identity = provenance(), fixture = fixtureHash(), checkpoint = checkpointHash(), browser = browserHash();
const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
const levels = [];
for (const level of ['L1', 'L2']) {
  const report = read<LevelAcceptance>(`docs/reports/fix51-verify/${level}.json`);
  assert.equal(report.sourceHash, identity.sourceHash); assert.equal(report.observerHash, identity.observerHash);
  assert.equal(report.fixtureHash, fixture); assert.equal(report.checkpointHash, checkpoint);
  for (const tier of ['low', 'high']) {
    let complete: NativeReceipt | undefined;
    for (const policy of ['complete', 'stationary']) {
      const r = read<NativeReceipt>(`docs/reports/fix51-verify/receipts/${level}-${tier}-${policy}.json`);
      assert.equal(r.sourceHash, identity.sourceHash); assert.equal(r.observerHash, identity.observerHash);
      assert.equal(r.error, null); assert(r.run && r.observation && r.threat);
      if (policy === 'complete') { assert(r.run.completed); complete = r; }
    }
    const f = read<FixtureReceipt>(`docs/reports/fix51-verify/receipts/${level}-${tier}-fixtures.json`);
    assert.equal(f.sourceHash, identity.sourceHash); assert.equal(f.fixtureHash, fixture); assert.deepEqual(f.errors, []);
    const c = read<CheckpointReceipt>(`docs/reports/fix51-verify/receipts/${level}-${tier}-checkpoints.json`);
    assert.equal(c.sourceHash, identity.sourceHash); assert.equal(c.fixtureHash, fixture); assert.equal(c.checkpointHash, checkpoint);
    assert(c.control.identical); assert.equal(c.control.observed, complete!.nativeStateHash); assert.deepEqual(c.errors, []);
    const b = read<FixtureReceipt & { browserHash: string }>(`docs/reports/fix51-verify/receipts/${level}-${tier}-browser.json`);
    assert.equal(b.sourceHash, identity.sourceHash); assert.equal(b.browserHash, browser); assert.deepEqual(b.errors, []);
    const check = b.checks.find(c => c.id === 'G-25'); assert(check && check.status === 'PASS');
    const value = check.value as { completed: boolean; skipped: string[]; consoleErrors: string[] };
    assert(value.completed); assert.deepEqual(value.skipped, []); assert.deepEqual(value.consoleErrors, []);
    const raw = `test-results/fix51-browser/${level}-${tier}/accept-completion.json`;
    const end = read<{ backend: string; quality: string; camera: { zoom: number }; levels: unknown[] }>(raw);
    assert.equal(end.backend, 'webgl'); assert.equal(end.quality, tier); assert.equal(end.camera.zoom, 1.5);
    assert(!existsSync(`test-results/fix51-browser/${level}-${tier}/captures`));
    atomicJson(`docs/reports/fix51-verify/receipts/${level}-${tier}-browser-completion.json`, {
      sourceHash: identity.sourceHash, browserHash: browser, backend: end.backend, quality: tier, zoom: end.camera.zoom,
      levels: end.levels, launchPolicy: 'headless; macOS ANGLE/Metal; shared pool; ephemeral non3300 port; no frame timing',
    });
  }
  levels.push({ level, sourceAndObserverMatch: true, fixturesAndControlsMatch: true, physicalRoutesCompleteBothTiers: true,
    freshFailures: report.rows.filter(r => r.currentStatus === 'FAIL').map(r => r.id) });
}
atomicJson('docs/reports/fix55-a/scope-audit.json', { ...identity, fixtureHash: fixture, checkpointHash: checkpoint,
  browserHash: browser, scope: ['L1', 'L2'], result: 'PASS for receipt integrity; acceptance failures remain', levels,
  globalAudit: 'Not qualified: other levels outside lane scope.' });
console.log('PASS: current L1/L2 receipt identities, native completion, fixtures, controls and four physical routes');
