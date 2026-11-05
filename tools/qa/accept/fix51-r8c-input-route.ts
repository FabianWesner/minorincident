import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { runSession } from '../../playtest/session';
import { provenance } from './probe';
import { browserHash } from './browser';
import { atomicJson } from './report';

// runSession uses launchProfile/shared admission; choices below are ordinary keyboard inputs.
const [level, tier] = process.argv.slice(2);
assert((level === 'L5' || level === 'L8') && (tier === 'low' || tier === 'high'));
const identity = provenance(), hash = browserHash();
const build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8'));
assert.equal(build.sourceHash, identity.sourceHash); assert.equal(build.browserHash, hash);
const cell = `${level}-${tier}-webgpu-z1.5-${level === 'L5' ? 'map-tour' : 'army-mg'}`;
const out = resolve(`test-results/fix51-r8c/${cell}-${Date.now()}`);
mkdirSync(out, { recursive: true });
const socket = createServer();
await new Promise<void>((ready, reject) => { socket.once('error', reject); socket.listen(0, '127.0.0.1', ready); });
const address = socket.address(); assert(address && typeof address !== 'string' && address.port !== 3300);
const port = address.port; await new Promise<void>(ready => socket.close(() => ready()));
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let result: Awaited<ReturnType<typeof runSession>> | null = null, error: string | null = null;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* own server starting */ }
    await delay(100);
  }
  assert(ready, 'Owned preview must start');
  Object.assign(process.env, { PLAYTEST_BACKEND: 'webgpu', PLAYTEST_GOD: '1', PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0', PLAYTEST_L5_TOUR: level === 'L5' ? '1' : '0' });
  result = await runSession({ origin, out, levels: [level], quality: tier, zoom: 1.5, heroine: 'female', entry: 'debug', profile: join(out, 'profile'),
    levelMinutes: level === 'L5' ? 9 : 6, stopAfterLevel: true, tag: 'input-route', noSkip: true, weapon: level === 'L8' ? 'weapon.army-mg' : undefined });
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }
const completion = join(out, 'input-route-completion.json');
const runtime = existsSync(completion) ? JSON.parse(readFileSync(completion, 'utf8')) as { backend: string; quality: string; camera: { zoom: number } } : null;
const runtimeMatches = runtime?.backend === 'webgpu' && runtime.quality === tier && runtime.camera.zoom === 1.5;
const consoleErrors = result?.issues.filter(issue => ['console-error', 'page-error'].includes(issue.kind)) ?? [];
const completed = !!result?.runs.length && result.runs.every(run => run.finished && !run.skipped.length);
const pass = !error && completed && !consoleErrors.length && runtimeMatches;
atomicJson(`docs/reports/fix51-r8c/${cell}.json`, { ...identity, browserHash: hash, cell, artifacts: { directory: out },
  toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'),
  method: 'Physical WASD/mouse, protected courier, no objective skips or actor writes. L5 uses the existing static authored-map search assist; L8 selects the carried army MG through its ordinary shortcut instead of the driver default. Original failed driver receipts remain separate.',
  result, error, runtimeMatches, runtime: runtime ? { backend: runtime.backend, quality: runtime.quality, zoom: runtime.camera.zoom } : null,
  checks: [{ id: 'G-25', status: pass ? 'PASS' : consoleErrors.length ? 'FAIL' : 'NOT CHECKED', completed, consoleErrors }], pass });
console.log(cell, { completed, consoleErrors: consoleErrors.length, pass, error });
process.exitCode = pass ? 0 : 1;
