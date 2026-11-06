/** One bounded G-25 physical route, retaining captures for explicit review. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { provenance } from './probe.ts';
import { browserHash } from './browser.ts';
import { mergeBrowserBatches } from './browser-chain.ts';
import { atomicJson } from './report.ts';

const [level, tier, backend = 'webgl2'] = process.argv.slice(2);
if (existsSync('test-results/sweep-g/pause-browser-matrix')) { console.log(`Paused before ${level}/${tier}; no browser context opened.`); process.exit(0); }
if (!/^L([1-9]|10)$/.test(level) || !['low', 'high'].includes(tier) || !['webgl2', 'webgpu'].includes(backend)) throw new Error('Usage: sweep-g-browser.mjs L<N> low|high [webgl2|webgpu]');
const suffix = backend === 'webgl2' ? '-webgl2' : '';
const phase = process.env.SWEEP_G_PHASE ? `${process.env.SWEEP_G_PHASE}-` : '';
const out = resolve(`test-results/sweep-g/G-25-${phase}${level}-${tier}${suffix}`);
mkdirSync(out, { recursive: true });
const options = { level, tier, origin: process.env.SWEEP_G_ORIGIN ?? 'http://127.0.0.1:4981', out,
  path: `docs/reports/sweep-g/G-25-${phase}${level}-${tier}${suffix}.json`, sourceHash: provenance().sourceHash,
  browserHash: browserHash(), backend, zoom: 1.5 };
const batches = [];
let resumeFrom;
const retainedFirst = process.env.SWEEP_G_RESUME_FIRST;
if (retainedFirst) {
  const first = JSON.parse(readFileSync(retainedFirst, 'utf8'));
  if (level !== 'L10' || first.sourceHash !== options.sourceHash || first.browserHash !== options.browserHash || first.tier !== tier || first.backend !== backend || first.batch?.index !== 1 || first.batch.startSaveHash !== null || !first.batch.yielded || !first.batch.savePath || first.errors.length) throw new Error('Retry needs the matching successful first production-save interval');
  batches.push({ path: retainedFirst, receipt: first });
  resumeFrom = first.batch.savePath;
}
for (let batchIndex = retainedFirst ? 2 : 1; batchIndex <= (level === 'L10' ? 8 : 1); batchIndex++) {
const batchOptions = level === 'L10' ? { ...options, batchIndex, resumeFrom,
  out: resolve(out, `batch${batchIndex}`), path: options.path.replace(/\.json$/, `-batch${batchIndex}.json`) } : options;
mkdirSync(batchOptions.out, { recursive: true });
const run = spawnSync(process.execPath, ['--import', 'tsx/esm', 'tools/qa/accept/browser-worker.ts', JSON.stringify(batchOptions)], {
  stdio: 'inherit', timeout: 590000 + Number(process.env.BROWSER_POOL_WAIT_MS ?? 120000),
  env: { ...process.env, BROWSER_POOL_JOB_ID: 'sweep-g', BROWSER_POOL_WAIT_MS: process.env.BROWSER_POOL_WAIT_MS ?? '120000',
    PLAYTEST_GOD: '1', PLAYTEST_BACKEND: backend, PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0',
    PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_ACCEPTANCE_CAPTURES: '1', PLAYTEST_ACCEPTANCE_CAPTURE_TIERS: 'single',
    ...(level === 'L7' ? { PLAYTEST_L7_ESCORT_ROUTE: '1' } : {}),
    ...(level === 'L5' ? { PLAYTEST_L5_TOUR: '1' } : {}),
    PLAYTEST_REVEAL_AUDIT: '1', QA_ACCEPT_KEEP_CAPTURES: '1' },
});
if (run.error) console.error(run.error);
process.exitCode = run.status ?? 1;
const receipt = JSON.parse(readFileSync(batchOptions.path, 'utf8'));
batches.push({ path: batchOptions.path, receipt });
if (run.status !== 0 || receipt.errors.length || !receipt.batch?.yielded || !receipt.batch.savePath || receipt.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind))) break;
resumeFrom = receipt.batch.savePath;
}
if (level === 'L10') atomicJson(options.path, { ...mergeBrowserBatches(batches, options.path), ...(retainedFirst ? { retry: { retainedFirst, reason: 'One unchanged-driver retry after research-campus no-progress stop; failed branch retained separately.' } } : {}) });
