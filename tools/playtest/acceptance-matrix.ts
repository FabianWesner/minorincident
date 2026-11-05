/** Physical-input acceptance samples. Run after build:qa; owns its preview and
 * one headless browser at a time. Partial samples never qualify completion. */
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { provenance } from '../qa/accept/probe';
import { browserHash } from '../qa/accept/browser';
import type { SessionOptions } from './session';

const { values } = parseArgs({ options: {
  levels: { type: 'string', default: 'L4,L5,L6,L7' }, tiers: { type: 'string', default: 'low,high' },
  zooms: { type: 'string', default: '0.5,1.5' }, backend: { type: 'string', default: 'webgl2' },
  seconds: { type: 'string', default: '90' }, port: { type: 'string' }, out: { type: 'string' }, 'record-build': { type: 'boolean' },
} });
const fingerprint = () => {
  const hash = createHash('sha256');
  for (const file of readdirSync('dist/build').filter(f => f.endsWith('.js')).sort()) hash.update(file).update(readFileSync(join('dist/build', file)));
  return hash.digest('hex');
};
if (values['record-build']) {
  if (!existsSync('dist/index.html')) throw new Error('Run build:qa first');
  writeFileSync('dist/.playtest-build.json', JSON.stringify({ ...provenance(), buildHash: fingerprint() }, null, 2) + '\n');
  console.log('Recorded playtest build provenance.'); process.exit(0);
}
const levels = values.levels!.split(','), tiers = values.tiers!.split(','), zooms = values.zooms!.split(',').map(Number);
const backend = values.backend!, seconds = Number(values.seconds), port = Number(values.port);
if (levels.some(l => !/^L(?:[1-9]|10)$/.test(l)) || tiers.some(t => !['low', 'high'].includes(t)) || zooms.some(z => ![.5, 1.5].includes(z)) || !['webgl2', 'webgpu'].includes(backend) || !Number.isFinite(seconds) || seconds < 30 || seconds > 480 || !Number.isInteger(port) || port < 1024 || port > 65534 || port === 3300 || !values.out) throw new Error('Use --levels L1,...,L10 --tiers low,high --zooms 0.5,1.5 --backend webgl2|webgpu --seconds30..480 --port<unique> --out<owned-directory>');
if (!existsSync('dist/index.html')) throw new Error('Run npm run build:qa before the matrix');
const out = resolve(values.out), origin = `http://127.0.0.1:${port}`;
if (!existsSync('dist/.playtest-build.json')) throw new Error('Immediately after build:qa, run this tool with --record-build');
const identity = JSON.parse(readFileSync('dist/.playtest-build.json', 'utf8')) as ReturnType<typeof provenance> & { buildHash: string };
mkdirSync(out, { recursive: true });
const buildHash = fingerprint();
if (identity.buildHash !== buildHash) throw new Error('Compiled build fingerprint differs from its provenance stamp');
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
const rows: unknown[] = [];
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned server starting */ } await new Promise(r => setTimeout(r, 100)); }
  if (!ready) throw new Error('Owned matrix preview did not start');
  for (const level of levels) for (const quality of tiers) for (const zoom of zooms) {
    const tag = `${level}-${quality}-z${zoom}-${backend}`, runOut = join(out, tag);
    const options: SessionOptions = { origin, out: runOut, levels: [level], quality: quality as 'low' | 'high', zoom,
      heroine: 'female', entry: 'debug', profile: join(runOut, 'profile'), levelMinutes: 9, stopAfterLevel: true, tag: 'matrix', noSkip: true, sampleSeconds: seconds };
    if (existsSync(runOut)) throw new Error(`Use a fresh output directory; refusing stale run artifacts: ${runOut}`);
    mkdirSync(runOut, { recursive: true });
    const driverHash = browserHash();
    const result = spawnSync('sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/playtest/session.ts', JSON.stringify(options)], {
      stdio: 'inherit', timeout: 590000,
      env: { ...process.env, BROWSER_POOL_WAIT_MS: process.env.BROWSER_POOL_WAIT_MS ?? '180000', E2E_ADMISSION_TIMEOUT_SECONDS: '180', E2E_PORT: String(port), SCENE_PORT: String(port + 1), E2E_UNITS: '1', PLAYTEST_BACKEND: backend, PLAYTEST_GOD: '1',
        PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0', PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_AUDIO_CUES: '1', PLAYTEST_ACCEPTANCE_CAPTURES: '1', PLAYTEST_ACCEPTANCE_CAPTURE_TIERS: 'single' },
    });
    const read = (file: string) => existsSync(join(runOut, file)) ? JSON.parse(readFileSync(join(runOut, file), 'utf8')) : [];
    const runs = read('runs-matrix.json'), issues = read('issues-matrix.json');
    const log = existsSync(join(runOut, 'log-matrix.jsonl')) ? readFileSync(join(runOut, 'log-matrix.jsonl'), 'utf8').trim().split('\n').map(line => JSON.parse(line)) : [];
    const consoleErrors = issues.filter((i: { kind: string }) => ['console-error', 'page-error'].includes(i.kind));
    const receipt = { version: 1, ...identity, buildHash, browserHash: driverHash, level, quality, zoom, requestedBackend: backend, renderer: log.find(r => r.renderer)?.renderer ?? null,
      input: 'physical WASD/mouse/E; no objective skips', headless: true, survivalProtected: true, frameTiming: false, sampleSeconds: seconds,
      status: consoleErrors.length ? 'FAIL' : result.status === 0 && runs.some((r: { finished: boolean; skipped: string[] }) => r.finished && !r.skipped.length) ? 'PASS' : 'NOT CHECKED',
      processExitCode: result.status, runs, issues, ledger: read('matrix-acceptance-ledger.json'), audio: read('matrix-audio.json'), photos: log.filter(r => r.acceptancePhoto).map(r => r.acceptancePhoto), out: runOut };
    writeFileSync(join(runOut, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n'); rows.push(receipt);
    writeFileSync(join(out, 'matrix.json'), JSON.stringify(rows, null, 2) + '\n');
    console.log(`[matrix] ${tag}: ${receipt.status}`);
    if (result.status !== 0) throw new Error(`Matrix worker failed or exhausted admission budget: ${tag}; exit=${result.status}; ${result.error ?? result.signal ?? ''}`);
  }
} finally { server.kill('SIGTERM'); }
