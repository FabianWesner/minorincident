/** Bounded physical WASD/mouse verification through the shared headless pool.
 * <level> <tier> <backend> <zoom> <preset|fresh|tracked|resume:label> <label> [seconds] [direct|road|countryside|dry-shortcut]
 * Resume rebinds the portable profile to its new caller-owned preview origin.
 * The tracked source is the existing physical research-to-complex save, not a staged boss. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession, type SessionOptions } from '../playtest/session';
import { provenance } from './accept/probe';
import { browserHash } from './accept/browser';

const [level, tier, backend, zoom, source, label, seconds = '420', route = 'direct'] = process.argv.slice(2);
assert(['L7', 'L8', 'L9', 'L10'].includes(level) && ['low', 'high'].includes(tier));
assert(['webgl2', 'webgpu'].includes(backend) && Number(seconds) <= 480);
assert(['direct', 'road', 'countryside', 'dry-shortcut'].includes(route));
const out = resolve(`test-results/vqa-fix-4/${label}`), profile = join(out, 'profile');
mkdirSync(profile, { recursive: true });
const identity = provenance(), build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
const toolSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), inputToolHash = browserHash();
const diagnostics = { mortalCheckpointRetry: process.env.PLAYTEST_L10_DIE_ONCE === '1', consoleWalk: process.env.PLAYTEST_L10_CONSOLE_WALK === '1', arenaPull: process.env.PLAYTEST_L10_PULL_AWAY === '1' };
assert.equal(build.sourceHash, identity.sourceHash, 'Build the current game and record its acceptance identity before input verification');
writeFileSync(join(out, 'build.json'), JSON.stringify(build, null, 2) + '\n');
const socket = createServer();
await new Promise<void>((done, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', done); });
const address = socket.address(); assert(address && typeof address === 'object' && address.port !== 3300);
const origin = `http://127.0.0.1:${address.port}`;
await new Promise<void>(done => socket.close(() => done()));
if (source !== 'fresh') {
  const save = source === 'tracked'
    ? JSON.parse(gunzipSync(execFileSync('git', ['show', `40f3d1de9:docs/reports/fix51-r10c/L10-${tier}-second-resume.json.gz`])).toString())
    : source.startsWith('resume:')
      ? JSON.parse(JSON.parse(readFileSync(resolve(`test-results/vqa-fix-4/${source.slice(7)}/profile/pool-storage.json`), 'utf8')).origins.flatMap((o: { localStorage: { name: string; value: string }[] }) => o.localStorage).find((s: { name: string }) => s.name === SAVE_KEY).value)
      : preset(`${level}-default` as ProgressionPreset);
  save.settings.quality = tier;
  writeFileSync(join(profile, 'pool-storage.json'), JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] }));
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(address.port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let result: Awaited<ReturnType<typeof runSession>> | null = null, error: string | null = null;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned preview starts */ } await new Promise(done => setTimeout(done, 100)); }
  assert(ready);
  process.env.PLAYTEST_CONTROL_FILE ??= join(out, 'control.json');
  Object.assign(process.env, { PLAYTEST_BACKEND: backend, PLAYTEST_GOD: '1', PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0', PLAYTEST_ACCEPTANCE_CAPTURES: '1', PLAYTEST_THREAT_AUDIT: '1', PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_REVEAL_AUDIT: '1', PLAYTEST_SHOT_SECONDS: process.env.PLAYTEST_SHOT_SECONDS ?? '5' });
  result = await runSession({ origin, out, levels: [level], quality: tier as 'low' | 'high', zoom: Number(zoom), heroine: 'female',
    entry: source === 'fresh' ? 'debug' : 'continue', profile, levelMinutes: 9, sampleSeconds: Number(seconds), stopAfterLevel: true, tag: label, noSkip: true,
    l9Route: route === 'direct' ? undefined : route as SessionOptions['l9Route'], saveOnYield: level === 'L10' } as SessionOptions);
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); }
const receipt = { ...identity, build, level, tier, backend, zoom: Number(zoom), source, route, result, error,
  toolSha256, inputToolHash, diagnostics,
  method: 'Physical WASD/mouse, unpaused gameplay, shared headless Metal pool. Courier protection disclosed; followers and APC retain ordinary damage. No objective skips, actor writes or performance timing. Per-step photos pause and restore quality/zoom.' };
writeFileSync(join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ label, error, runs: result?.runs.map(r => ({ level: r.level, finished: r.finished, skips: r.skipped, deaths: r.deaths })) }));
process.exitCode = error ? 1 : 0;
