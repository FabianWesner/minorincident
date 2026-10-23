import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SceneSession, readSpec, stopServer } from '../scenelab/session';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use tools/perf/quiet-run.sh');
const output = process.argv[2] ?? 'test-results/browser-pool/timing.json';
const session = new SceneSession({ backend: 'webgl2', nativeFrameTiming: true, tier: 'high' });
try {
  await session.open(); await session.load(readSpec('specs/scenes/house.json')); await session.ready();
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
  const result = { at: new Date().toISOString(), pooled: process.env.MI_BROWSER_POOL === '1', conditions: process.env.PERF_CONDITIONS_LOG, commandLine: info.commandLine, backend: (await session.metrics()).backend, rounds: rounds.map(frames => ({ frames, p50: percentile(frames, .5), p95: percentile(frames, .95), max: Math.max(...frames) })) };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ output, pooled: result.pooled, rounds: result.rounds.map(({ p50, p95, max }) => ({ p50, p95, max })) }));
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }
