/** Matched public builds, five empty shared-pool contexts per level/build. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const origins = process.argv.slice(2);
assert.equal(origins.length, 3, 'pass batch21, main and fix production-preview origins');
for (const origin of origins) assert.notEqual(new URL(origin).port, '3300');
const variants = ['batch21', 'main', 'fix'];
const revisions = ['83503eb18ccdfcc1a0c04bb5791527ea87dbacdb', '8b3c847d9', execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()];
const out = resolve(process.env.LOAD_OUT ?? 'test-results/q212-load/matrix');
const rows: { variant: string; level: string; max: number }[] = [];
for (const level of ['L1', 'L2', 'L3', 'L4']) for (const [index, variant] of variants.entries()) {
  const path = `${out}/${variant}`; mkdirSync(path, { recursive: true });
  const log = openSync(`${path}/${level}.log`, 'w');
  const child = spawn('sh', ['tools/e2e-lock.sh', process.execPath, '--import', 'tsx', 'tools/perf/cold-load-time.ts', origins[index], 'webgpu', 'high', '5', level, '0'], {
    env: { ...process.env, LOAD_OUT: path, E2E_UNITS: '1' }, stdio: ['ignore', log, log],
  });
  const code = await new Promise<number>((done, reject) => { child.once('error', reject); child.once('exit', value => done(value ?? 1)); }); closeSync(log);
  assert.equal(code, 0, `${variant}/${level}: see ${path}/${level}.log`);
  const summary = JSON.parse(readFileSync(`${path}/${level}-webgpu-high-summary.json`, 'utf8'));
  const samples = Array.from({ length: 5 }, (_, n) => JSON.parse(readFileSync(`${path}/${level}-webgpu-high-${n}.json`, 'utf8')));
  assert.deepEqual(summary.errors, []);
  assert.equal(summary.n, 5);
  assert.ok(samples.every(s => !s.diagnostic && s.contexts.includes('webgpu') && !s.contexts.includes('webgl2')));
  assert.ok(samples.every(s => s.adapter?.architecture === 'metal-3' && s.adapter?.fallback === false));
  assert.ok(samples.every(s => s.frames.length >= 2), 'each load must present frames after the card closes');
  assert.ok(samples.some(s => s.gameplayMs >= 10_000 && s.frames.filter((f: { playing: boolean }) => f.playing).length >= 100), 'each configuration must include ten seconds of real gameplay frames');
  const row = { variant, revision: revisions[index], level, ...summary, samples: samples.map(s => ({ ms: s.ms, load: s.load, bundle: s.bundle, adapter: s.adapter, sampledAt: s.sampledAt })) };
  rows.push(row); writeFileSync(`${out}/summary.json`, JSON.stringify({
    method: 'Production builds served by Vite preview on the same Mac; 1600×900, DPR1, high tier, native Metal WebGPU. Five empty contexts per row, shared pool admission, no artificial menu wait; real level-select click to loading-card closure/Begin availability. OS/browser driver caches remain shared. No CPU build/test work launched by this job during the matrix.', rows,
  }, null, 2));
  console.log(JSON.stringify({ variant, level, max: summary.max, median: summary.median }));
}
const worst = (variant: string, level: string) => rows.find(row => row.variant === variant && row.level === level)!.max;
const checks = { l3Absolute: worst('fix', 'L3') <= 5150, l3Regression: worst('fix', 'L3') <= worst('batch21', 'L3') * 1.1, l4Absolute: worst('fix', 'L4') <= 6000 };
const summary = JSON.parse(readFileSync(`${out}/summary.json`, 'utf8'));
writeFileSync(`${out}/summary.json`, JSON.stringify({ ...summary, limits: { l3Ms: 5150, l3Ratio: 1.1, l4Ms: 6000 }, checks }, null, 2));
assert.ok(Object.values(checks).every(Boolean), JSON.stringify(checks));
