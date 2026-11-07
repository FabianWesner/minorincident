/** Scoped alternate authored L9 route; canonical worker retained unchanged. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
// runSession owns launchProfile from the shared headless browser pool. Keep
// this entry visible to e2e-lock's migrated-launcher detection for every batch.
import { runSession } from '../../playtest/session';
import { atomicJson } from './report';
import type { RunnerLevel } from '../../sim-runner/levels';
import type { Tier } from './probe';
import { SAVE_KEY, encodeSave, validateSave } from '../../../src/sim/progression/Save';
import type { CampaignSave } from '../../../src/sim/progression/Campaign';
import type { BrowserReceipt } from './browser-chain';

// runSession uses the headless launchProfile adapter. L10 reserves a browser
// per bounded Resume slice; shorter routes use shared functional admission.

const options = JSON.parse(process.argv[2]) as { level: RunnerLevel; tier: Tier; origin: string; out: string; path: string; sourceHash: string; browserHash: string; backend: 'webgl2' | 'webgpu'; zoom: .5 | 1.5; batchIndex?: number; resumeFrom?: string };
const receipt: BrowserReceipt = { version: 1, level: options.level, tier: options.tier, sourceHash: options.sourceHash, fixtureHash: options.browserHash, browserHash: options.browserHash, checks: [], errors: [], run: [], issues: [], frameTiming: false, backend: options.backend, zoom: options.zoom };
const hashSave = (save: CampaignSave) => createHash('sha256').update(JSON.stringify(save)).digest('hex');
try {
  const profile = join(options.out, 'profile');
  let start: CampaignSave | null = null;
  if (options.resumeFrom) {
    start = JSON.parse(gunzipSync(readFileSync(options.resumeFrom)).toString()) as CampaignSave;
    assert(options.level === 'L10' && options.batchIndex && options.batchIndex > 1 && validateSave(start) && start.cureResume, 'Resume requires the previous actual production save');
    mkdirSync(profile, { recursive: true });
    writeFileSync(join(profile, 'pool-storage.json'), JSON.stringify({ cookies: [], origins: [{ origin: options.origin, localStorage: [{ name: SAVE_KEY, value: encodeSave(start) }] }] }));
  }
  const batching = options.level === 'L10' && options.batchIndex !== undefined;
  const result = await runSession({ origin: options.origin, out: options.out, levels: [options.level], quality: options.tier, zoom: options.zoom, heroine: 'female', entry: start ? 'continue' : options.level === 'L1' ? 'new' : 'debug', profile, levelMinutes: batching || ['L4', 'L5', 'L7'].includes(options.level) ? 9 : 6,
    sampleSeconds: batching ? 480 : undefined, saveOnYield: batching, stopAfterLevel: true, tag: 'accept', noSkip: true,
    // Separately labelled existing authored countryside route, physical WASD only.
    // This does not change the game or repair the road-driver orbit.
    l9Route: options.level === 'L9' ? 'countryside' : undefined });
  receipt.run = result.runs; receipt.issues = result.issues;
  const run = result.runs.find(run => run.level === options.level), errors = result.issues.filter(issue => issue.kind === 'console-error' || issue.kind === 'page-error');
  if (batching) {
    const completion = JSON.parse(readFileSync(join(options.out, 'accept-completion.json'), 'utf8')) as { campaign: CampaignSave; backend: string; quality: string; camera: { zoom: number } };
    assert.equal(completion.backend, options.backend === 'webgl2' ? 'webgl' : 'webgpu');
    assert.equal(completion.quality, options.tier);
    // A completed physical finale reports 1.5000000000000002 for requested
    // 1.5 after the pullout. Preserve the matrix check with float roundoff only.
    assert(Math.abs(completion.camera.zoom - options.zoom) < 1e-9);
    const save = completion.campaign;
    assert(validateSave(save), 'batch must retain a valid campaign');
    if (run?.finished) assert(save.completedLevels >= 10, 'full route must finish credits');
    const savePath = result.yielded ? options.path.replace(/\.json$/, '-save.json.gz') : null;
    if (savePath) {
      assert(save.cureResume, 'Settings must capture a live Resume snapshot');
      writeFileSync(savePath, gzipSync(JSON.stringify(save)));
    }
    receipt.batch = { index: options.batchIndex!, yielded: result.yielded, startSaveHash: start ? hashSave(start) : null,
      endSaveHash: savePath ? hashSave(save) : null, startSeconds: start?.cureResume?.current.state.stats.time ?? null,
      endSeconds: save.cureResume?.current.state.stats.time ?? null, savePath };
    receipt.observations = { runtime: { backend: completion.backend, quality: completion.quality, zoom: completion.camera.zoom }, productionResume: true };
  }
  receipt.checks.push({ id: 'G-25', clause: 'physical WASD/mouse full-level browser console', tier: options.tier, policy: `real-input-${options.backend}`, status: errors.length ? 'FAIL' : run?.finished && !run.skipped.length ? 'PASS' : 'NOT CHECKED', value: { backend: options.backend, zoom: options.zoom, completed: run?.finished ?? false, skipped: run?.skipped ?? [], consoleErrors: errors, immortal: true, frameTiming: false }, target: 'complete ordinary-input route; zero console/page errors; no objective skips', receipt: options.path });
} catch (error) {
  receipt.errors.push(String(error));
  const issues = join(options.out, 'issues-accept.json');
  if (existsSync(issues)) receipt.issues = JSON.parse(readFileSync(issues, 'utf8'));
} finally {
  // Only this fresh worker owns these captures and its isolated browser profile.
  if (process.env.QA_ACCEPT_KEEP_CAPTURES !== '1') rmSync(join(options.out, 'captures'), { recursive: true, force: true });
  rmSync(join(options.out, 'profile'), { recursive: true, force: true });
  receipt.observations = { ...receipt.observations, alternateRoute: 'countryside', producer: { file: 'tools/qa/accept/final-g-l9-worker.ts', sha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') }, provenanceNote: 'browserHash identifies the unchanged canonical observer/playtest bundle. This separately identified launcher selects the existing authored countryside route; the canonical road trial remains unchanged and retained.' };
  atomicJson(options.path, receipt);
}
process.exitCode = receipt.errors.length || receipt.checks.some(check => check.status === 'FAIL') ? 1 : 0;
