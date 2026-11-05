import { createServer } from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { browserHash, browserProbes } from './browser';
import { mergeBrowserBatches, type BrowserReceipt } from './browser-chain';
import { provenance } from './probe';
import { atomicJson } from './report';
import { runnerLevels } from '../../sim-runner/levels';

const identity = provenance(), hash = browserHash();
const suffix = process.argv[3] ?? 'all';
if (!/^[a-z0-9-]+$/.test(suffix)) throw new Error('Invalid output suffix');
const requested = process.argv[2]?.split(',') ?? [...runnerLevels];
const selected = requested.map(id => runnerLevels.find(level => level === id));
if (!selected.length || selected.some(level => !level) || new Set(selected).size !== selected.length) throw new Error('Expected unique comma-separated L1–L10 levels');

/** Wait before the bounded worker starts, so queued admission cannot consume its gameplay budget. */
async function sharedCapacity(): Promise<void> {
  const deadline = Date.now() + 1_800_000;
  let lastNotice = 0;
  for (;;) {
    try {
      const response = await fetch(`${process.env.BROWSER_POOL_URL ?? 'http://127.0.0.1:4329'}/status`, { signal: AbortSignal.timeout(3000) });
      if (!response.ok) throw new Error(`Pool status HTTP ${response.status}`);
      const status = await response.json() as { leases: unknown[]; waiters: unknown[]; starting?: unknown[]; exclusive: unknown[]; limit: number };
      if (!status.exclusive.length && !status.waiters.length && status.leases.length + (status.starting?.length ?? 0) < status.limit) return;
    } catch (error) {
      if (Date.now() - lastNotice > 30_000) { console.log('[r8c matrix] Pool status read failed; retrying:', String(error)); lastNotice = Date.now(); }
    }
    if (Date.now() >= deadline) throw new Error('Shared browser admission remained unavailable for 30 minutes');
    await delay(1000);
  }
}
async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((ready, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', ready); });
  const address = server.address();
  if (!address || typeof address === 'string' || address.port === 3300) throw new Error('No unique preview port');
  await new Promise<void>(ready => server.close(() => ready()));
  return address.port;
}

/** Same canonical worker/chain verifier, with shared admission and continuation of already verified production saves. */
async function resumeL10(): Promise<{ path: string; receipt: BrowserReceipt }[]> {
  const marker = 'dist/.qa-accept-build.json';
  const build = existsSync(marker) ? JSON.parse(readFileSync(marker, 'utf8')) as { sourceHash: string; browserHash: string } : null;
  if (!existsSync('dist/index.html') || build?.sourceHash !== identity.sourceHash || build.browserHash !== hash) {
    const built = spawnSync('npm', ['run', 'build:qa'], { stdio: 'inherit' });
    if (built.status !== 0) throw new Error('QA build failed');
    writeFileSync(marker, JSON.stringify({ sourceHash: identity.sourceHash, browserHash: hash }));
  }
  const port = await freePort(), scenePort = await freePort(), origin = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  const results: { path: string; receipt: BrowserReceipt }[] = [];
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* own server starting */ }
      await delay(100);
    }
    if (!ready) throw new Error('Owned preview did not start');
    for (const tier of ['low', 'high'] as const) {
      const path = `docs/reports/fix51-verify/receipts/L10-${tier}-webgpu-z1.5-browser.json`;
      const batches: { path: string; receipt: BrowserReceipt }[] = [];
      let resumeFrom: string | undefined;
      for (let index = 1; index <= 8; index++) {
        const batchPath = path.replace(/\.json$/, `-batch${index}.json`);
        let receipt = existsSync(batchPath) ? JSON.parse(readFileSync(batchPath, 'utf8')) as BrowserReceipt : null;
        const reusable = receipt?.sourceHash === identity.sourceHash && receipt.browserHash === hash && receipt.backend === 'webgpu' && receipt.tier === tier
          && !receipt.errors.length && receipt.batch?.index === index && receipt.run.length === 1
          && (index === 1 ? receipt.batch.startSaveHash === null : receipt.batch.startSaveHash === batches.at(-1)?.receipt.batch?.endSaveHash);
        if (!reusable) {
          await sharedCapacity();
          const out = resolve(`test-results/fix51-browser/L10-${tier}-webgpu-z1.5/batch${index}`);
          mkdirSync(out, { recursive: true });
          const before = existsSync(batchPath) ? statSync(batchPath).mtimeMs : null;
          const options = { level: 'L10', tier, origin, out, path: batchPath, sourceHash: identity.sourceHash, browserHash: hash, backend: 'webgpu', zoom: 1.5, batchIndex: index, resumeFrom };
          // browser-worker uses launchProfile; direct admission is shared rather than the opaque shell entry.
          const run = spawnSync('sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx/esm', 'tools/qa/accept/browser-worker.ts', JSON.stringify(options)], {
            stdio: 'inherit', timeout: 650_000,
            env: { ...process.env, E2E_PORT: String(port), SCENE_PORT: String(scenePort), E2E_UNITS: '1', BROWSER_POOL_WAIT_MS: '120000', E2E_ADMISSION_TIMEOUT_SECONDS: '1800', PLAYTEST_GOD: '1', PLAYTEST_BACKEND: 'webgpu', PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0' },
          });
          receipt = existsSync(batchPath) ? JSON.parse(readFileSync(batchPath, 'utf8')) as BrowserReceipt : null;
          if (!receipt || statSync(batchPath).mtimeMs === before || receipt.sourceHash !== identity.sourceHash || receipt.browserHash !== hash)
            throw new Error(`No fresh L10 ${tier}/batch${index} receipt (exit ${run.status})`);
        }
        if (!receipt) throw new Error('Missing batch receipt');
        batches.push({ path: batchPath, receipt });
        atomicJson(path, mergeBrowserBatches(batches, path));
        console.log(`[r8c matrix] L10 ${tier}/batch${index}: ${receipt.batch?.yielded ? 'production Resume saved' : 'terminal'}; ${receipt.errors.length} errors`);
        if (receipt.errors.length || !receipt.batch?.yielded || receipt.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind))) break;
        if (!receipt.batch.savePath || !existsSync(receipt.batch.savePath)) throw new Error('Production Resume save missing');
        resumeFrom = receipt.batch.savePath;
      }
      const receipt = mergeBrowserBatches(batches, path);
      atomicJson(path, receipt); results.push({ path, receipt });
    }
  } finally { server.kill('SIGTERM'); }
  return results;
}

const rows = [];
type Runtime = { backend?: string; quality?: string; camera?: { zoom?: number }; zoom?: number };
for (const level of selected) {
  if (!level) throw new Error('Missing level');
  if (level !== 'L10') await sharedCapacity();
  const results = level === 'L10' ? await resumeL10() : await browserProbes(level, ['low', 'high'], identity.sourceHash, true, { backend: 'webgpu', zoom: 1.5 });
  rows.push(...results.map(({ path, receipt }) => {
    const completion = join('test-results/fix51-browser', `${level}-${receipt.tier}-webgpu-z1.5`, 'accept-completion.json');
    const runtime = (level === 'L10' ? receipt.observations?.runtime : existsSync(completion) ? JSON.parse(readFileSync(completion, 'utf8')) : null) as Runtime | null | undefined;
    return { level, path, receipt, runtime: runtime ? { backend: runtime.backend, quality: runtime.quality, zoom: runtime.zoom ?? runtime.camera?.zoom } : null,
      runtimeMatches: !!runtime && runtime.backend === 'webgpu' && runtime.quality === receipt.tier && (runtime.zoom ?? runtime.camera?.zoom) === 1.5 };
  }));
  atomicJson(`docs/reports/fix51-r8c/webgpu-matrix-${suffix}.json`, { ...identity,
    method: 'Canonical physical WASD/mouse worker; L10 retains connected production Resume saves and uses shared pool admission; actual renderer/quality/zoom checked independently.',
    complete: selected.length === 10 && rows.length === 20 && rows.every(row => row.runtimeMatches && row.receipt.checks.some(check => check.id === 'G-25' && check.status === 'PASS') && !row.receipt.errors.length), rows });
  console.log(level, results.map(result => ({ path: result.path, errors: result.receipt.errors, checks: result.receipt.checks })));
}
