import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { join } from 'node:path';
import { provenance, type NativeReceipt } from './probe';
import { fixtureHash, type FixtureReceipt } from './fixtures';
import { checkpointHash, type CheckpointReceipt } from './checkpoints';
import { browserHash } from './browser';
import { atomicJson, attachPerformanceRemeasurements, buildLevelReport, reportRoot, rowResult, sourceRows, type AcceptanceRow, type LevelAcceptance } from './report';
import type { RunnerLevel } from '../../sim-runner/levels';
import { validateReviewDirectory } from './reviews';

const { values } = parseArgs({ options: { base: { type: 'string' } } });
const identity = provenance(), sources = sourceRows();
validateReviewDirectory();
const read = <T>(path: string) => JSON.parse(readFileSync(path, 'utf8')) as T;
let nativeRuns = 0, controls = 0, checkpointCases = 0, browserRuns = 0;
const reports: LevelAcceptance[] = [], controlRows: { level: string; tier: string; identical: boolean }[] = [];
for (let n = 1; n <= 10; n++) {
  const level = `L${n}` as RunnerLevel, report = read<LevelAcceptance>(join(reportRoot, `${level}.json`));
  assert.equal(report.sourceHash, identity.sourceHash); assert.equal(report.observerHash, identity.observerHash);
  assert.equal(report.fixtureHash, fixtureHash()); assert.equal(report.checkpointHash, checkpointHash());
  const native: { path: string; receipt: NativeReceipt }[] = [], fixtures: { path: string; receipt: FixtureReceipt }[] = [];
  for (const tier of ['low', 'high']) {
    for (const policy of ['complete', 'stationary']) {
      const path = join(reportRoot, 'receipts', `${level}-${tier}-${policy}.json`), receipt = read<NativeReceipt>(path);
      assert.equal(receipt.sourceHash, identity.sourceHash); assert.equal(receipt.observerHash, identity.observerHash);
      assert.equal(receipt.level, level); assert.equal(receipt.tier, tier); assert.equal(receipt.policy, policy); assert.equal(receipt.error, null);
      assert(receipt.observation && receipt.threat && receipt.run, `missing native data ${path}`);
      if (policy === 'complete') assert(receipt.run.completed, `incomplete competent route ${path}`);
      native.push({ path, receipt }); nativeRuns++;
    }
    for (const kind of ['fixtures', 'checkpoints']) {
      const path = join(reportRoot, 'receipts', `${level}-${tier}-${kind}.json`), receipt = read<FixtureReceipt>(path);
      assert.equal(receipt.sourceHash, identity.sourceHash); assert.equal(receipt.tier, tier); assert.equal(receipt.level, level); assert.deepEqual(receipt.errors, []);
      if (kind === 'fixtures') assert.equal(receipt.fixtureHash, fixtureHash());
      else {
        const proof = receipt as CheckpointReceipt;
        assert.equal(proof.checkpointHash, checkpointHash()); assert(proof.control.identical, `observer changed state ${level}/${tier}`);
        assert.equal(proof.control.observed, native.find(item => item.receipt.tier === tier && item.receipt.policy === 'complete')!.receipt.nativeStateHash);
        controls++; checkpointCases += proof.checks.filter(check => check.id === 'G-21').length;
        controlRows.push({ level, tier, identical: proof.control.identical });
      }
      fixtures.push({ path, receipt });
    }
  }
  for (const file of readdirSync(join(reportRoot, 'receipts')).filter(file => new RegExp(`^${level}-(low|high)(-(webgl2|webgpu)-z(0\\.5|1\\.5))?-browser\\.json$`).test(file))) {
    const path = join(reportRoot, 'receipts', file);
    const receipt = read<FixtureReceipt & { browserHash: string; backend?: string; zoom?: number; batchRunnerSha256?: string; inputDriverSha256?: string }>(path);
    if (receipt.sourceHash !== identity.sourceHash || receipt.browserHash !== browserHash()) {
      assert(!report.policies.some(policy => policy.receipt === path), 'a historical browser receipt was included as current evidence');
      // A --skip-browser acceptance run is still auditable: historical physical
      // receipts are excluded rather than admitted as current evidence.
      continue; // Historical alternate zoom/backend files are not part of this report.
    }
    assert.equal(receipt.sourceHash, identity.sourceHash); assert.equal(receipt.browserHash, browserHash()); assert.deepEqual(receipt.errors, []);
    if (receipt.batchRunnerSha256) {
      assert.equal(level, 'L10');
      const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
      assert.equal(receipt.batchRunnerSha256, sha('tools/qa/fix51-r4-l10-batch.mjs'));
      assert.equal(receipt.inputDriverSha256, sha('tools/playtest/session.ts'));
      const value = receipt.checks.find(c => c.id === 'G-25')!.value as { segmented: boolean; completed: boolean; initialBudgetAbort: string; batchEvidence: { receipt: string; completion: string }[] };
      assert(value.segmented && value.completed && value.batchEvidence.length);
      const prefix = JSON.parse(gunzipSync(readFileSync(value.initialBudgetAbort.replace('-initial.json', '-completion.json.gz'))).toString()) as { campaign: { cureResume: { current: { tick: number } } } };
      let tick = prefix.campaign.cureResume.current.tick;
      let seconds = (prefix.campaign.cureResume.current as unknown as { state: { stats: { time: number } } }).state.stats.time;
      const runnerVersions = [receipt.batchRunnerSha256, sha('tools/qa/fix51-r4-l10-batch-v1.txt')];
      for (const evidence of value.batchEvidence) {
        const root = 'docs/reports/fix51-r4/';
        const batch = JSON.parse(gunzipSync(readFileSync(root + evidence.receipt)).toString()) as { startTick: number; finished: boolean; inputDriverSha256: string; batchRunnerSha256: string; run: { skipped: string[] } };
        const end = JSON.parse(gunzipSync(readFileSync(root + evidence.completion)).toString()) as { campaign: { completedLevels: number; cureResume?: { current: { tick: number } } } };
        assert.equal(batch.startTick, tick, 'Resume must use the preceding actual save');
        assert.equal(batch.inputDriverSha256, receipt.inputDriverSha256); assert(runnerVersions.includes(batch.batchRunnerSha256));
        assert.deepEqual(batch.run.skipped, []);
        if (batch.finished) assert(end.campaign.completedLevels >= 10);
        else { const cumulative = (end.campaign.cureResume!.current as unknown as { state: { stats: { time: number } } }).state.stats.time; assert(cumulative > seconds, 'production Resume must advance cumulative mission time'); seconds = cumulative; tick = end.campaign.cureResume!.current.tick; }
      }
    }
    fixtures.push({ path, receipt }); browserRuns++;
    const caseName = file.replace('-browser.json', ''), directory = `test-results/fix51-browser/${caseName}`;
    const raw = `${directory}/accept-completion.json`;
    if (existsSync(raw)) {
      const end = read<{ backend: string; quality: string; camera: { zoom: number }; levels: unknown[] }>(raw);
      assert.equal(end.backend, receipt.backend === 'webgpu' ? 'webgpu' : 'webgl'); assert.equal(end.quality, receipt.tier);
      assert.equal(end.camera.zoom, receipt.zoom ?? 1.5);
      atomicJson(join(reportRoot, 'receipts', `${caseName}-browser-completion.json`), { sourceHash: identity.sourceHash, browserHash: browserHash(), backend: end.backend, quality: end.quality, zoom: end.camera.zoom, levels: end.levels, launchPolicy: 'headless; macOS ANGLE/Metal; isolated profile; ephemeral non3300 preview port; no frame/CPU timing' });
    }
    assert(!existsSync(`${directory}/captures`), 'raw browser captures must be removed');
  }
  const group = (path: string) => path.endsWith('-checkpoints.json') ? 1 : path.endsWith('-browser.json') ? 2 : 0;
  fixtures.sort((a, b) => group(a.path) - group(b.path) || (a.receipt.tier === b.receipt.tier ? 0 : a.receipt.tier === 'low' ? -1 : 1));
  const rebuilt = buildLevelReport(level, native, fixtures, checkpointHash());
  assert.deepEqual(report.rows, rebuilt.rows, `stale level evaluation ${level}`);
  assert.deepEqual(report.globals, rebuilt.globals, `stale global evaluation ${level}`);
  assert.deepEqual(report.rows.map(row => row.id), sources.filter(source => source.level === level).map(source => source.id));
  reports.push(report);
}
const globals = read<{ rows: AcceptanceRow[]; levels: string[] }>(join(reportRoot, 'global.json'));
assert.equal(globals.levels.length, 10);
const expectedGlobals = attachPerformanceRemeasurements(sources.filter(source => source.level === 'global').map(source => rowResult(source, reports.flatMap(report => report.globals.find(row => row.id === source.id)?.checks ?? []))), identity.sourceHash);
assert.deepEqual(globals.rows, expectedGlobals);
const rows = [...globals.rows, ...reports.flatMap(report => report.rows)];
assert.equal(rows.length, 169); assert.equal(new Set(rows.map(row => row.id)).size, 169);
for (const row of rows) {
  if (row.historical.status === 'FAIL') assert.equal(row.status, 'FAIL', `cleared prior FAIL ${row.id}`);
  if (row.status === 'FAIL') assert(row.historical.status === 'FAIL' || row.checks.some(check => check.status === 'FAIL'), `unsupported FAIL ${row.id}`);
  for (const path of row.receipt) if (!existsSync(path)) {
    const archivedReview = row.reviewDecision?.evidence.some(evidence => evidence.file === path && /^[0-9a-f]{64}$/.test(evidence.sha256));
    assert(archivedReview || row.historical.evidence.includes(path), `missing current receipt ${path}`);
    // Historical receipts and manual review evidence can be archived. Review
    // decisions retain their digest and observation in the review JSON.
  }
}
const proof = read<{ sourceHash: string; observerHash: string; evaluationHash: string; results: { detected: boolean }[]; compoundCoverage: boolean; globalMatrixCoverage: boolean }>(join(reportRoot, 'evaluator-proof.json'));
assert.equal(proof.sourceHash, identity.sourceHash); assert.equal(proof.observerHash, identity.observerHash);
const evaluationHash = createHash('sha256').update(readFileSync(new URL('./evaluate.ts', import.meta.url))).update(readFileSync(new URL('./report.ts', import.meta.url))).update(readFileSync(new URL('./reviews.ts', import.meta.url))).update(readFileSync(new URL('./proof.ts', import.meta.url))).digest('hex');
assert.equal(proof.evaluationHash, evaluationHash, 'stale evaluator fault proof');
assert(proof.compoundCoverage && proof.globalMatrixCoverage && proof.results.length >= 18 && proof.results.every(result => result.detected));
const faults = read<{ sourceHash: string; fixtureHash: string; checkpointHash: string; codeHash: string; results: { detected: boolean }[] }>(join(reportRoot, 'fault-proof.json'));
assert.equal(faults.sourceHash, identity.sourceHash); assert.equal(faults.fixtureHash, fixtureHash()); assert.equal(faults.checkpointHash, checkpointHash());
assert.equal(faults.codeHash, createHash('sha256').update(readFileSync(new URL('./fault-proof.ts', import.meta.url))).digest('hex'));
assert(faults.results.length >= 8 && faults.results.every(result => result.detected));
const validation = read<{ sourceHash: string; fixtureHash: string; checkpointHash: string; qaToolHash: string; pass: boolean; runs: { command: string; exitCode: number; log: string }[] }>(join(reportRoot, 'validation.json'));
const qaHash = createHash('sha256');
for (const path of ['tools/qa/accept.ts', 'tools/playtest/session.ts', ...readdirSync('tools/qa/accept').filter(path => path.endsWith('.ts')).map(path => `tools/qa/accept/${path}`)].sort()) qaHash.update(path).update(readFileSync(path));
assert.equal(validation.sourceHash, identity.sourceHash); assert.equal(validation.fixtureHash, fixtureHash()); assert.equal(validation.checkpointHash, checkpointHash()); assert.equal(validation.qaToolHash, qaHash.digest('hex'), 'repository gates precede current QA code');
assert(validation.pass && validation.runs.length === 3 && validation.runs.every(run => run.exitCode === 0));
assert.deepEqual(validation.runs.map(run => run.command), ['npx tsc --noEmit', 'npm run lint', 'npm test']);
const base = values.base ?? read<NativeReceipt>(join(reportRoot, 'receipts/L1-low-complete.json')).revision;
const gameDiff = execFileSync('git', ['diff', base, '--', 'src', 'specs'], { encoding: 'utf8' });
assert.equal(gameDiff, '', 'game source and specs must remain unchanged');
// Explicit orchestrator decision for this lane. Remove only the exact added
// sentence before comparing the entire source table; no other clause may move.
const clarification = ' Clarification: score reachability from the first physical perimeter breach/gate opening onward; every infected must have a legal ground, vault, or attack-through-barrier path once the perimeter permits it, with no permanent geometry trap.';
const reviewConvention = '\nManual review decisions live in `docs/qa/reviews/<ROW-ID>.json` with row/status/reviewer/date/commit, exact criterion clause verdicts, and evidence file SHA-256 hashes; the tracker accepts a review only when the criterion text matches and the reviewed game commit is current for that level and shared render paths.';
const originalCriteria = execFileSync('git', ['show', `${base}:docs/qa/level-acceptance.md`], { encoding: 'utf8' });
const currentCriteria = readFileSync('docs/qa/level-acceptance.md', 'utf8');
assert.equal(currentCriteria.replace(clarification, '').replace(`${reviewConvention}\n`, ''), originalCriteria.replace(clarification, '').replace(`${reviewConvention}\n`, ''), 'acceptance targets changed beyond authorized L4-07 clarification and review convention');
atomicJson(join(reportRoot, 'control-proof.json'), { ...identity, controls: controlRows });
const counts = rows.reduce<Record<string, number>>((counts, row) => { counts[row.status] = (counts[row.status] ?? 0) + 1; return counts; }, {});
const result = { ...identity, fixtureHash: fixtureHash(), checkpointHash: checkpointHash(), generatedAt: new Date().toISOString(), inventory: rows.length, counts, measuredRows: rows.filter(row => row.checks.some(check => check.status !== 'NOT CHECKED')).length, observedRows: rows.filter(row => row.checks.length).length, freshFailRows: rows.filter(row => row.currentStatus === 'FAIL').length, nativeRuns, controls, checkpointCases, browserRuns, brokenEvaluatorFixtures: proof.results.length, injectedProductionFaults: faults.results.length, sourceAndTargetsUnchangedSince: base, authorizedCriteriaClarification: { row: 'L4-07', decision: clarification.trim() }, remaining: rows.filter(row => row.currentStatus === 'NOT CHECKED').map(row => row.id), pass: true };
atomicJson(join(reportRoot, 'audit.json'), result);
console.log(JSON.stringify(result, null, 2));
