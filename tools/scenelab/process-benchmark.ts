import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, openSync, closeSync, readFileSync, readdirSync, cpSync } from 'node:fs';
import { resolve } from 'node:path';
import { sample, type Sample } from '../perf/process-sampler';
import { writeJson } from './session';

// Benchmark actual CLI lanes (1..4 private dev/preview servers) or the Playwright runner (1..2 workers).
if (process.env.MI_PERF_LOCK_HELD !== '1' || process.env.MI_E2E_LOCK_HELD !== '1') throw new Error('Use tools/perf/quiet-run.sh');
const args = process.argv.slice(2), flag = (name: string, fallback: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? fallback : args[i + 1]; };
const mode = flag('mode', 'lanes'), parallel = Number(flag('parallel', '1'));
const sharedPreview = args.includes('--shared-preview');
if (!['lanes', 'playwright'].includes(mode) || !Number.isInteger(parallel) || parallel < 1 || parallel > (mode === 'lanes' ? 4 : 2)) throw new Error('Invalid mode or parallelism (Playwright maximum 2)');
const out = resolve(flag('out', `test-results/render-parallel/${mode}-${parallel}`));
mkdirSync(out, { recursive: true });
const files = ['bench-sitter', 'house', 'courier-turns', 'qa-grove-east-south'];
let preview: ChildProcess | undefined;
let snapshotMs = 0, buildId: string | undefined;
if (sharedPreview) {
  // Prototype immutable build sharing. Includes the full served content digest so dirty dist
  // and different public assets cannot masquerade as the same Git commit.
  const start = Date.now(), hash = createHash('sha256');
  const digest = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = `${dir}/${entry.name}`;
      hash.update(path.slice(5));
      if (entry.isDirectory()) digest(path); else hash.update(readFileSync(path));
    }
  };
  digest('dist');
  buildId = `${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()}-${hash.digest('hex').slice(0, 16)}`;
  const snapshot = `${out}/build-${buildId}`;
  cpSync('dist', snapshot, { recursive: true });
  snapshotMs = Date.now() - start;
  preview = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--outDir', snapshot, '--host', '127.0.0.1', '--port', '3472', '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (preview.exitCode !== null) throw new Error('Owned preview server exited before readiness');
    try { ready = (await fetch('http://127.0.0.1:3472')).ok; } catch { /* Poll owned server. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) { preview.kill(); throw new Error('Owned preview server did not become ready'); }
}
const results: unknown[] = [], samples: Sample[] = [];
let scenes = 0;
const began = Date.now();
const timer = setInterval(() => samples.push(sample()), 1000);
const run = async (argv: string[], env: NodeJS.ProcessEnv, log: string) => {
  const fd = openSync(log, 'w');
  try {
    const child = spawn(process.execPath, argv, { env, stdio: ['ignore', fd, fd] });
    return await new Promise<number | null>((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  } finally { closeSync(fd); }
};
try {
  samples.push(sample());
  if (mode === 'lanes') for (let round = 0; round < 2; round++) {
    await Promise.all(Array.from({ length: parallel }, async (_, worker) => {
      const dest = `${out}/round-${round}/worker-${worker}`;
      mkdirSync(dest, { recursive: true });
      const exit = await run(['node_modules/tsx/dist/cli.mjs', 'tools/scenelab/cli.ts', ...files.map(name => `specs/scenes/${name}.json`), '--out', dest], { ...process.env, ...(sharedPreview ? { SCENE_SERVER: 'preview' } : {}), SCENE_PORT: String(sharedPreview ? 3472 : 3472 + worker) }, `${dest}/log.txt`);
      for (const name of files) {
        try {
          const data = JSON.parse(readFileSync(`${dest}/${name}/metrics.json`, 'utf8'));
          results.push({ round, worker, name, exit, backend: data.backend, checks: data.checks, timing: data.timing, consoleErrors: data.consoleErrors });
          scenes++;
        } catch (error) { results.push({ round, worker, name, exit, error: String(error) }); }
      }
    }));
  }
  else {
    const exit = await run(['node_modules/playwright/cli.js', 'test', '-c', 'tools/scenelab/benchmark.config.ts', `--workers=${parallel}`], { ...process.env, E2E_PORT: '3476', SCENE_PORT: '3476', SCENE_SERVER: 'preview', BENCH_REPORT: `${out}/playwright.json`, BENCH_OUT: out }, `${out}/log.txt`);
    const data = JSON.parse(readFileSync(`${out}/playwright.json`, 'utf8'));
    scenes = data.stats.expected + data.stats.unexpected;
    results.push({ exit, stats: data.stats, errors: data.errors });
  }
  samples.push(sample());
  const measuredMs = Date.now() - began;
  writeJson(`${out}/summary.json`, { mode, server: sharedPreview ? 'shared-preview' : process.env.SCENE_SERVER ?? 'dev', buildId, snapshotMs, parallel, measuredMs, scenes, scenesPerMinute: scenes * 60000 / measuredMs, peakRssMiB: Math.max(...samples.map(s => s.rssMiB)), peakCpuPercent: Math.max(...samples.map(s => s.cpuPercent)), peakGpuPercent: Math.max(...samples.map(s => s.gpuPercent ?? 0)), results, samples });
  console.log(JSON.stringify({ mode, parallel, seconds: measuredMs / 1000 }));
} finally { clearInterval(timer); preview?.kill(); }
