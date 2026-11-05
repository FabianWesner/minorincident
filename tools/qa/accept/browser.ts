import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import type { RunnerLevel } from '../../sim-runner/levels';
import type { Tier } from './probe';
import type { FixtureReceipt } from './fixtures';
import { atomicJson, reportRoot } from './report';
import { mergeBrowserBatches, type BrowserReceipt } from './browser-chain';

export function browserHash(): string {
  const hash = createHash('sha256');
  for (const path of ['tools/qa/accept/browser.ts', 'tools/qa/accept/browser-worker.ts', 'tools/qa/accept/browser-chain.ts', 'tools/qa/accept/browser-batch.sh', ...readdirSync('tools/playtest').filter(file => file.endsWith('.ts')).map(file => join('tools/playtest', file))].sort()) hash.update(path).update(readFileSync(path));
  return hash.digest('hex');
}
export function reusableBrowserReceipt(receipt: (FixtureReceipt & { browserHash: string }) | null, sourceHash: string, hash: string): boolean {
  return !!receipt && receipt.sourceHash === sourceHash && receipt.browserHash === hash && !receipt.errors.length && receipt.checks.length > 0 && receipt.checks.every(check => check.status === 'PASS');
}
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('No local preview port');
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}
export async function browserProbes(level: RunnerLevel, tiers: Tier[], sourceHash: string, reuse: boolean, matrix: { backend: 'webgl2' | 'webgpu'; zoom: .5 | 1.5 } = { backend: 'webgl2', zoom: 1.5 }): Promise<{ path: string; receipt: FixtureReceipt }[]> {
  const hash = browserHash(), results: { path: string; receipt: FixtureReceipt }[] = [];
  const marker = 'dist/.qa-accept-build.json';
  const build = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')) as { sourceHash: string; browserHash: string } : null;
  if (!existsSync('dist/index.html') || build?.sourceHash !== sourceHash || build.browserHash !== hash) {
    const built = spawnSync('npm', ['run', 'build:qa'], { stdio: 'inherit' });
    if (built.status !== 0) throw new Error(`QA build failed (${built.status})`);
    writeFileSync(marker, JSON.stringify({ sourceHash, browserHash: hash }));
  }
  const port = await freePort(); let scenePort = await freePort();
  while (scenePort === port) scenePort = await freePort();
  if (port === 3300 || scenePort === 3300) throw new Error('Reserved development port');
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* own preview still starting */ } await new Promise(resolve => setTimeout(resolve, 100)); }
    if (!ready) throw new Error('Owned QA preview did not start');
    for (const tier of tiers) {
      const suffix = matrix.backend === 'webgl2' && matrix.zoom === 1.5 ? '' : `-${matrix.backend}-z${matrix.zoom}`;
      const path = join(reportRoot, 'receipts', `${level}-${tier}${suffix}-browser.json`), out = resolve('test-results/fix51-browser', `${level}-${tier}${suffix}`);
      const old = reuse && existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) as FixtureReceipt & { browserHash: string } : null;
      if (old && reusableBrowserReceipt(old, sourceHash, hash)) { results.push({ path, receipt: old }); continue; }
      mkdirSync(out, { recursive: true });
      const options = { level, tier, origin, out, path, sourceHash, browserHash: hash, ...matrix };
      const batches: { path: string; receipt: BrowserReceipt }[] = [];
      let resumeFrom: string | undefined;
      for (let batchIndex = 1; batchIndex <= (level === 'L10' ? 8 : 1); batchIndex++) {
        const batchPath = level === 'L10' ? path.replace(/\.json$/, `-batch${batchIndex}.json`) : path;
        const batchOut = level === 'L10' ? join(out, `batch${batchIndex}`) : out;
        mkdirSync(batchOut, { recursive: true });
        const batchOptions = { ...options, out: batchOut, path: batchPath, ...(level === 'L10' ? { batchIndex, resumeFrom } : {}) };
        const priorWrite = existsSync(batchPath) ? statSync(batchPath).mtimeMs : null;
        const poolWaitMs = process.env.BROWSER_POOL_WAIT_MS ?? '120000';
        const admissionSeconds = process.env.E2E_ADMISSION_TIMEOUT_SECONDS ?? (level === 'L10' ? '1800' : '120');
        const worker = [process.execPath, '--import', 'tsx/esm', 'tools/qa/accept/browser-worker.ts', JSON.stringify(batchOptions)];
        const run = spawnSync('sh', ['tools/e2e-lock.sh', ...worker], { stdio: 'inherit', timeout: 590000 + Math.max(Number(poolWaitMs), Number(admissionSeconds) * 1000),
          env: { ...process.env, E2E_PORT: String(port), SCENE_PORT: String(scenePort), E2E_UNITS: '1', E2E_ADMISSION_TIMEOUT_SECONDS: admissionSeconds, BROWSER_POOL_WAIT_MS: poolWaitMs, PLAYTEST_GOD: '1', PLAYTEST_BACKEND: matrix.backend, PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0' } });
        let receipt = existsSync(batchPath) ? JSON.parse(readFileSync(batchPath, 'utf8')) as BrowserReceipt : null;
        if (!receipt || receipt.sourceHash !== sourceHash || receipt.fixtureHash !== hash || statSync(batchPath).mtimeMs === priorWrite) {
          // Admission can fail before the worker runs. An old receipt at this
          // path is historical evidence, not the result of this attempt.
          receipt = { version: 1, level, tier, sourceHash, fixtureHash: hash, browserHash: hash, ...matrix, frameTiming: false, run: [], issues: [], checks: [], errors: [`Browser worker produced no current receipt (status ${run.status}; ${String(run.error ?? 'admission or worker failure')})`], observations: { ...matrix } };
          atomicJson(batchPath, receipt);
        }
        batches.push({ path: batchPath, receipt });
        if (run.status !== 0 || receipt.errors.length || !receipt.batch?.yielded || !receipt.batch.savePath || receipt.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind))) break;
        resumeFrom = receipt.batch.savePath;
      }
      const receipt = level === 'L10' ? mergeBrowserBatches(batches, path) : batches[0].receipt;
      if (level === 'L10') atomicJson(path, receipt);
      results.push({ path, receipt });
    }
  } finally { server.kill('SIGTERM'); }
  return results;
}
