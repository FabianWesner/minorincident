import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { cpus, totalmem, platform, release } from 'node:os';
import { basename, dirname, resolve } from 'node:path';
import { PNG } from 'pngjs';

// Compact, auditable results plus exact decoded-pixel comparisons. No browser work.
const root = resolve(process.argv[2] ?? 'test-results/render-parallel');
const output = process.argv[3] ?? 'docs/reports/render-test-parallel-data.json';
const baseline = new Map(), setups = [];
const hash = file => createHash('sha256').update(PNG.sync.read(readFileSync(file)).data).digest('hex');
const shots = dir => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const path = `${dir}/${entry.name}`;
  if (entry.name.startsWith('build-')) return [];
  if (entry.isDirectory()) return shots(path);
  return /^shot-\d+\.png$/.test(entry.name) ? [path] : [];
});
for (const [backend, setup] of [['webgl', 'isolated-shell-1'], ['webgpu', 'isolated-webgpu-1']]) {
  if (!existsSync(`${root}/${setup}`)) continue;
  for (const file of shots(`${root}/${setup}/round-0/worker-0`)) baseline.set(`${backend}/${basename(dirname(file))}/${basename(file)}`, hash(file));
}
for (const entry of readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
  if (!entry.isDirectory() || entry.name.includes('failure')) continue;
  const summary = `${root}/${entry.name}/summary.json`;
  if (!existsSync(summary)) continue;
  const data = JSON.parse(readFileSync(summary));
  if (Array.isArray(data)) continue; // Capability probes are reported separately.
  const backend = data.results.find(r => r.backend)?.backend ?? 'webgl';
  const captures = shots(`${root}/${entry.name}`).map(file => {
    const scene = basename(dirname(file)).replace(/^\d+-/, '');
    const key = `${scene}/${basename(file)}`, pixels = hash(file);
    return { file: file.slice(root.length + 1), scene, hash: pixels, baselineMatch: pixels === baseline.get(`${backend}/${key}`) };
  });
  const samples = data.samples;
  setups.push({
    setup: entry.name, mode: data.mode, channel: data.channel, server: data.server, backend,
    parallel: data.parallel, rounds: data.rounds ?? 2, measuredMs: data.measuredMs,
    totalMs: data.totalMs, scenesPerMinute: data.scenesPerMinute, peakRssMiB: data.peakRssMiB,
    peakCpuPercent: data.peakCpuPercent, peakGpuPercent: data.peakGpuPercent,
    meanGpuPercent: samples.reduce((n, s) => n + (s.gpuPercent ?? 0), 0) / samples.length,
    buildId: data.buildId, snapshotMs: data.snapshotMs, connectMs: data.connectMs,
    results: data.results.map(r => ({ round: r.round, worker: r.worker, scene: r.name, file: r.file, backend: r.backend, frames: r.frames, seconds: r.seconds, openMs: r.openMs, timing: r.timing, pass: r.pass, failed: r.failed, checks: r.checks, error: r.error, consoleErrors: r.consoleErrors, stats: r.stats, exit: r.exit, errors: r.errors, contextLost: r.diagnostics?.renderer?.contextLost, rendererMemory: r.diagnostics?.renderer?.memory?.total })),
    captureCount: captures.length, captureMismatches: captures.filter(c => !c.baselineMatch).length,
    captures, samples,
  });
}
const result = { date: new Date().toISOString().slice(0, 10), buildCommit: process.argv[4] ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(), memoryUnits: 'MiB', host: { chip: cpus()[0].model, cores: cpus().length, memoryGiB: totalmem() / 1024 ** 3, platform: platform(), release: release() }, setups };
if (existsSync(`${root}/backends-confirmed/summary.json`)) result.backends = JSON.parse(readFileSync(`${root}/backends-confirmed/summary.json`));
if (existsSync(`${root}/dawn.json`)) result.dawn = JSON.parse(readFileSync(`${root}/dawn.json`));
writeFileSync(output, JSON.stringify(result, null, 2));
for (const d of setups) console.log(JSON.stringify({ setup: d.setup, scenesPerMinute: Number(d.scenesPerMinute.toFixed(1)), peakRssMiB: Math.round(d.peakRssMiB), meanGpuPercent: Math.round(d.meanGpuPercent), captures: d.captureCount, mismatches: d.captureMismatches }));
