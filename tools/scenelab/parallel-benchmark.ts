import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { chromium, type Browser } from '@playwright/test';
import { PNG } from 'pngjs';
import { SceneSession, readSpec, stopServer, writeJson } from './session';
import { runSpec } from './run';
import { sample, type Sample } from '../perf/process-sampler';

/** Capacity probe; reserve ALL machine browser slots before running. Never a frame-budget gate.
 * SCENE_PORT=... SCENE_SERVER=preview sh tools/perf/quiet-run.sh npx tsx tools/scenelab/parallel-benchmark.ts
 * --mode isolated|shared|warm --parallel 1..4 --rounds 2 --channel shell|chromium --out DIR */
const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const mode = flag('mode', 'isolated'), parallel = Number(flag('parallel', '1')), rounds = Number(flag('rounds', '2'));
const channel = flag('channel', 'shell'), backend = flag('backend', 'webgl2');
const cdp = args.includes('--cdp');
if (!['isolated', 'shared', 'warm'].includes(mode) || !['shell', 'chromium'].includes(channel) || !['webgl2', 'webgpu'].includes(backend)
  || !Number.isInteger(parallel) || parallel < 1 || parallel > 4 || !Number.isInteger(rounds) || rounds < 1) throw new Error('Invalid benchmark options');
if (process.env.MI_E2E_LOCK_HELD !== '1' || process.env.MI_PERF_LOCK_HELD !== '1') throw new Error('Reserve all slots with tools/perf/quiet-run.sh first');
const out = resolve(flag('out', `test-results/render-parallel/${mode}-${channel}-${parallel}`));
mkdirSync(out, { recursive: true });
const files = ['bench-sitter', 'house', 'courier-turns', 'qa-grove-east-south'].map(name => `specs/scenes/${name}.json`);
if (cdp && mode === 'isolated') throw new Error('CDP probe requires shared or warm mode');
const browserArgs = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', ...(backend === 'webgpu' ? ['--enable-unsafe-webgpu'] : []), ...(cdp ? ['--remote-debugging-port=0'] : [])];
const launch = () => chromium.launch({ headless: true, args: browserArgs, ...(channel === 'chromium' ? { channel: 'chromium' } : {}) });

const results: unknown[] = [], samples: Sample[] = [], pixels: unknown[] = [];
let shared: Browser | undefined;
let hostBrowser: Browser | undefined;
let connectMs: number | undefined;
const sessions: SceneSession[] = [];
const start = Date.now();
const timer = setInterval(() => samples.push(sample()), 1000);
try {
  samples.push(sample());
  // Start the private server once before concurrent opens (avoid a port startup race).
  const primer = new SceneSession({ backend: backend as 'webgl2' | 'webgpu' });
  if (mode !== 'isolated' || channel !== 'shell') shared = await launch();
  if (cdp) {
    hostBrowser = shared;
    const client = await hostBrowser!.newBrowserCDPSession();
    const info = await client.send('SystemInfo.getInfo');
    await client.detach();
    const profile = info.commandLine.match(/--user-data-dir=(\S+)/)?.[1];
    if (!profile) throw new Error('No owned Chromium profile path');
    const debugPort = readFileSync(`${profile}/DevToolsActivePort`, 'utf8').split('\n')[0];
    const began = Date.now();
    shared = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
    connectMs = Date.now() - began;
  }
  await primer.open(shared);
  sessions.push(primer);
  if (shared) {
    const cdp = await shared!.newBrowserCDPSession();
    writeJson(`${out}/gpu.json`, await cdp.send('SystemInfo.getInfo'));
    await cdp.detach();
  }
  if (mode !== 'warm') await primer.close();
  if (mode === 'isolated') { await shared?.close(); shared = undefined; }
  const measuredStart = Date.now();
  for (let round = 0; round < rounds; round++) {
    const began = Date.now();
    const live: SceneSession[] = [];
    await Promise.all(Array.from({ length: parallel }, async (_, worker) => {
      const session = mode === 'warm' && sessions[worker] ? sessions[worker] : new SceneSession({ backend: backend as 'webgl2' | 'webgpu' });
      live.push(session);
      let local: Browser | undefined;
      try {
        const boot = Date.now();
        if (!(mode === 'warm' && sessions[worker])) {
          if (mode === 'isolated' && channel !== 'shell') local = await launch();
          await session.open(mode === 'isolated' ? local : shared);
          if (mode === 'warm') sessions[worker] = session;
        }
        const openMs = Date.now() - boot;
        for (const file of files) {
          const spec = readSpec(file), sceneOut = `${out}/round-${round}/worker-${worker}/${spec.name}`;
          // Keep real fixtures and their authored tick count / captures / gates.
          const result = await runSpec(session, spec, { file, out: sceneOut, openMs });
          const diagnostics = await session.page.evaluate(() => window.__SCENE__!.renderDiagnostics());
          const lastShot = result.files.filter(path => path.endsWith('.png')).at(-1)!;
          const png = PNG.sync.read(readFileSync(lastShot));
          let lit = 0; for (let i = 0; i < png.data.length; i += 4) if (Math.max(png.data[i], png.data[i + 1], png.data[i + 2]) > 8) lit++;
          const pixel = { round, worker, scene: spec.name, hash: createHash('sha256').update(png.data).digest('hex'), litFraction: lit / (png.width * png.height) };
          pixels.push(pixel);
          results.push({ round, worker, file, openMs, ...result, diagnostics, pixels: pixel });
          console.log(JSON.stringify({ round, worker, scene: spec.name, pass: result.pass, seconds: result.seconds, backend: result.backend, litFraction: pixel.litFraction }));
        }
      } catch (error) { results.push({ round, worker, error: String(error), consoleErrors: session.errors }); }
      finally { if (mode !== 'warm') await session.close(); await local?.close(); }
    }));
    console.log(JSON.stringify({ round, parallel, mode, seconds: (Date.now() - began) / 1000 }));
  }
  const elapsedMs = Date.now() - measuredStart;
  writeJson(`${out}/summary.json`, { mode, channel, backend, cdp, connectMs, parallel, rounds, files, measuredMs: elapsedMs, totalMs: Date.now() - start, scenesPerMinute: results.filter(r => 'file' in (r as object)).length * 60000 / elapsedMs, host: { cpu: cpus()[0].model, cores: cpus().length, memory: totalmem() }, peakRssMiB: Math.max(...samples.map(s => s.rssMiB)), peakCpuPercent: Math.max(...samples.map(s => s.cpuPercent)), peakGpuPercent: Math.max(...samples.map(s => s.gpuPercent ?? 0)), results, pixels, samples });
} finally {
  clearInterval(timer);
  await Promise.allSettled(sessions.map(s => s.close()));
  await shared?.close(); stopServer();
  await hostBrowser?.close();
  writeFileSync(`${out}/samples.json`, JSON.stringify(samples, null, 2));
}
