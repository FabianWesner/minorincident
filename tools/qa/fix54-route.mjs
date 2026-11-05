import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import { runSession } from '../playtest/session.ts';
import { provenance } from './accept/probe.ts';
import { browserHash } from './accept/browser.ts';

const [level, tier, backend = 'webgl2'] = process.argv.slice(2);
assert(['L1', 'L2', 'L3'].includes(level));
assert(['low', 'high'].includes(tier));
assert(['webgl2', 'webgpu'].includes(backend));
const variant = process.env.FIX54_VARIANT ?? 'candidate', buildDir = resolve(process.env.FIX54_DIST ?? 'dist');
const identity = provenance(), hash = browserHash(), toolSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
let revisionBuild = null;
if (existsSync(join(buildDir, 'revision-build.json'))) {
  revisionBuild = JSON.parse(readFileSync(join(buildDir, 'revision-build.json'), 'utf8'));
  const paths = execFileSync('git', ['ls-files', '-z', '--', 'src', 'layouts', 'public/assets/layouts'], { encoding: 'utf8' }).split('\0').filter(Boolean).sort();
  const pinned = execFileSync('git', ['ls-tree', '-r', '--name-only', revisionBuild.commit, '--', 'src', 'layouts', 'public/assets/layouts'], { encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(paths, pinned, 'Pinned source inventory must match this checkout');
  const changed = new Set(execFileSync('git', ['diff', '--name-only', revisionBuild.commit, '--', 'src', 'layouts', 'public/assets/layouts'], { encoding: 'utf8' }).trim().split('\n'));
  const source = createHash('sha256');
  for (const path of paths) source.update(path).update('\0').update(changed.has(path) ? execFileSync('git', ['show', `${revisionBuild.commit}:${path}`], { maxBuffer: 64 * 1024 * 1024 }) : readFileSync(path));
  identity.sourceHash = source.digest('hex'); identity.revision = revisionBuild.commit;
}
const out = resolve(`test-results/fix54-a/${level}-${tier}-${backend}${variant === 'candidate' ? '' : `-${variant}`}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise((ready, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', ready); });
const port = socket.address().port;
assert(port !== 3300);
await new Promise(ready => socket.close(ready));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--outDir', buildDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let result = null, error = null;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned preview is starting */ }
    await delay(100);
  }
  assert(ready, 'Owned preview must start');
  Object.assign(process.env, { MI_SLUG: 'fix54-a', PLAYTEST_BACKEND: backend, PLAYTEST_GOD: '1',
    PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0',
    PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_ACCEPTANCE_CAPTURES: variant === 'candidate' || process.env.FIX54_CAPTURE === '1' ? '1' : '0',
    PLAYTEST_ACCEPTANCE_CAPTURE_TIERS: 'single', PLAYTEST_L1_HANDOVERS: level === 'L1' ? '1' : '0' });
  result = await runSession({ origin, out, levels: [level], quality: tier, zoom: 1.5, heroine: 'female',
    entry: level === 'L1' ? 'new' : 'debug', profile: join(out, 'profile'), levelMinutes: 8,
    sampleSeconds: Number(process.env.FIX54_SAMPLE_SECONDS ?? '480'), stopAfterLevel: true, tag: 'route', noSkip: true });
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }
const receipt = { ...identity, browserHash: hash, level, tier, backend, variant, revisionBuild, out, toolSha256,
  input: 'Physical WASD/mouse/E; protected courier; no objective skips; shared headless browser pool; no frame timing', result, error };
writeFileSync(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2));
writeFileSync(join(out, 'log-route.jsonl.gz'), gzipSync(readFileSync(join(out, 'log-route.jsonl'))));
console.log(JSON.stringify(receipt, null, 2));
process.exitCode = error || result?.issues.some(issue => ['console-error', 'page-error', 'cannot-finish'].includes(issue.kind)) ? 1 : 0;
