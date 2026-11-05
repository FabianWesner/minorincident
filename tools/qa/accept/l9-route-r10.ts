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

// runSession uses launchProfile through the shared headless pool; all movement stays physical WASD.
const [tierArg, zoomArg, routeArg] = process.argv.slice(2);
assert(['low', 'high'].includes(tierArg) && ['0.5', '1.5'].includes(zoomArg) && ['road', 'countryside', 'dry-shortcut'].includes(routeArg));
const tier = tierArg as 'low' | 'high', zoom = Number(zoomArg), route = routeArg as 'road' | 'countryside' | 'dry-shortcut';
const identity = provenance(), hash = browserHash();
const build = JSON.parse(readFileSync('dist/.qa-accept-build.json', 'utf8')) as { sourceHash: string; browserHash: string };
assert.equal(build.sourceHash, identity.sourceHash); assert.equal(build.browserHash, hash);
const cell = `L9-${tier}-webgl2-z${zoom}-${route}`, out = resolve(`test-results/fix51-r10c/${cell}-${Date.now()}`);
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
    try { if ((await fetch(origin)).ok) { ready = true; break; } } catch { /* owned server starts */ }
    await delay(100);
  }
  assert(ready, 'Owned preview must start');
  process.env.PLAYTEST_BACKEND = 'webgl2'; process.env.PLAYTEST_GOD = '1';
  process.env.PLAYTEST_NO_FRAME_TIMING = '1'; process.env.PLAYTEST_FRAME_GATE = '0'; process.env.PLAYTEST_CPU_PROFILE = '0';
  process.env.PLAYTEST_THREAT_CAPTURES = '1';
  result = await runSession({ origin, out, levels: ['L9'], quality: tier, zoom, heroine: 'female', entry: 'debug', profile: join(out, 'profile'), levelMinutes: 8,
    sampleSeconds: 480, stopAfterLevel: true, tag: 'l9-route', noSkip: true, l9Route: route });
} catch (caught) { error = String(caught); }
finally { server.kill('SIGTERM'); rmSync(join(out, 'profile'), { recursive: true, force: true }); }

type Observation = { tick: number; driving?: unknown; enemies: { drawn: boolean }[] };
const logPath = join(out, 'log-l9-route.jsonl');
const entries = existsSync(logPath) ? readFileSync(logPath, 'utf8').trim().split('\n').map(line => JSON.parse(line) as { observation?: Observation }) : [];
const observations = entries.flatMap(entry => entry.observation ? [entry.observation] : []);
const driving = observations.filter(observation => observation.driving);
const positive = driving.filter(observation => observation.enemies.some(enemy => enemy.drawn));
const lastTick = driving.at(-1)?.tick ?? 0;
const inactive = observations.find(observation => observation.tick > lastTick && !observation.driving);
const completed = !!result?.runs.length && result.runs.every(run => run.finished && !run.skipped.length);
const consoleErrors = result?.issues.filter(issue => ['console-error', 'page-error'].includes(issue.kind)) ?? [];
const maximumSamplingSeconds = driving.length > 1 ? Math.max(...driving.slice(1).map((row, i) => (row.tick - driving[i].tick) / 60)) : null;
const ticks = [0, ...positive.map(row => row.tick), inactive?.tick ?? lastTick];
const largestGapSeconds = ticks.length > 1 ? Math.max(...ticks.slice(1).map((tick, i) => (tick - ticks[i]) / 60)) : null;
const conservativeGapSeconds = completed && inactive && positive.length && maximumSamplingSeconds !== null && largestGapSeconds !== null ? largestGapSeconds + maximumSamplingSeconds : null;
const completionPath = join(out, 'l9-route-completion.json');
const runtime = existsSync(completionPath) ? JSON.parse(readFileSync(completionPath, 'utf8')) as { backend: string; quality: string; camera: { zoom: number } } : null;
const runtimeMatches = runtime?.backend === 'webgl' && runtime.quality === tier && runtime.camera.zoom === zoom;
const pass = !error && completed && !consoleErrors.length && runtimeMatches && conservativeGapSeconds !== null && conservativeGapSeconds <= 60;
atomicJson(`docs/reports/fix51-r10c/${cell}.json`, { ...identity, browserHash: hash, toolSha256: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex'), cell, tier, zoom, route,
  artifacts: { directory: out, logSha256: existsSync(logPath) ? createHash('sha256').update(readFileSync(logPath)).digest('hex') : null },
  method: 'Full physical WASD route using the authored map assist; protected courier, no objective skips, no actor writes or frame timing. eyes.ts counts living submitted bodies with LOS and on-screen chest, not minimap dots. Photos pause simulation and restore camera/quality.',
  result, error, runtimeMatches, fullRouteConsolePass: !error && completed && !consoleErrors.length && runtimeMatches,
  visibility: { observations: driving.length, positiveTicks: positive.map(row => row.tick), firstInactiveTick: inactive?.tick ?? null, maximumSamplingSeconds, largestGapSeconds, conservativeGapSeconds, targetSeconds: 60, pass },
  runtime: runtime ? { backend: runtime.backend, quality: runtime.quality, zoom: runtime.camera.zoom } : null });
console.log(cell, { completed, consoleErrors: consoleErrors.length, conservativeGapSeconds, pass, error });
process.exitCode = pass ? 0 : 1;
