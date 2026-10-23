import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { quietConditions } from './host';
import { poolUrl } from './client';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use tools/perf/quiet-run.sh');
const output = process.argv[2] ?? 'test-results/browser-pool/timing.json';
const session = new SceneSession({ backend: 'webgl2', nativeFrameTiming: true, tier: 'high' });
try {
  const owned = new Set([process.pid]);
  if (process.env.MI_BROWSER_POOL === '1') {
    const status = await (await fetch(`${poolUrl()}/status`)).json() as { browsers: { pid: number }[] };
    for (const browser of status.browsers) owned.add(browser.pid);
  }
  const conditions = [await quietConditions(owned)];
  assert.equal(conditions[0].quiet, true, `Probe requires quiet admission: ${JSON.stringify(conditions[0])}`);
  let sampler: ReturnType<typeof setInterval> | undefined;
  try {
  await session.open(); await session.load(readSpec('specs/scenes/house.json')); await session.ready();
  if (process.env.MI_BROWSER_POOL === '1') {
    const status = await (await fetch(`${poolUrl()}/status`)).json() as { browsers: { pid: number }[] };
    for (const browser of status.browsers) owned.add(browser.pid);
  }
  conditions.push(await quietConditions(owned));
  assert.deepEqual(conditions.at(-1)!.busy, [], 'Host became busy while Chrome started');
  sampler = setInterval(() => { void quietConditions(owned).then(sample => conditions.push(sample)); }, 1000);
  const rounds = await session.page.evaluate(async () => {
    const api = window.__SS__!; api.resume();
    for (let i = 0; i < 180; i++) await new Promise(requestAnimationFrame);
    const rounds: number[][] = [];
    for (let round = 0; round < 3; round++) {
      const frames: number[] = []; let previous = 0;
      for (let i = 0; i < 901; i++) {
        const now = await new Promise<number>(requestAnimationFrame);
        if (previous) frames.push(now - previous); previous = now;
      }
      rounds.push(frames);
    }
    api.pause(); return rounds;
  });
  const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
  const cdp = await session.page.context().browser()!.newBrowserCDPSession();
  const info = await cdp.send('SystemInfo.getInfo'); await cdp.detach();
  if (sampler) clearInterval(sampler); conditions.push(await quietConditions(owned));
  assert.deepEqual(conditions.flatMap(c => c.busy), [], 'Foreign Blender/build/browser/Vitest overlapped the timing probe');
  const result = { hostConditions: conditions, at: new Date().toISOString(), pooled: process.env.MI_BROWSER_POOL === '1', conditions: process.env.PERF_CONDITIONS_LOG, commandLine: info.commandLine, backend: (await session.metrics()).backend, rounds: rounds.map(frames => ({ frames, p50: percentile(frames, .5), p95: percentile(frames, .95), max: Math.max(...frames) })) };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ output, pooled: result.pooled, rounds: result.rounds.map(({ p50, p95, max }) => ({ p50, p95, max })) }));
  assert.deepEqual(session.errors, []);
  } finally { if (sampler) clearInterval(sampler); }
} finally { await session.close(); stopServer(); }
