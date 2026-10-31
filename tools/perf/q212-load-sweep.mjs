/** Q-212: run the unchanged cold-load probe, one exclusive quiet reservation per row. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [origin, directory, selectedLevels = 'L1,L2,L3,L4,L5,L6,L7,L8,L9,L10', selectedTiers = 'high,low'] = process.argv.slice(2);
assert.ok(origin && directory, 'pass production-preview origin and output directory');
assert.notEqual(new URL(origin).port, '3300');
const out = resolve(directory);
mkdirSync(out, { recursive: true });
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const html = await fetch(origin).then(response => { assert.ok(response.ok); return response.text(); });
const entry = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html)?.[1];
assert.ok(entry, 'preview must expose the production module entry');
const bundle = await fetch(new URL(entry, origin)).then(response => { assert.ok(response.ok); return response.text(); });
const hash = value => createHash('sha256').update(value).digest('hex');
const identity = { revision, entry, bundleSha256: hash(bundle), coldLoadProbeSha256: hash(readFileSync('tools/perf/cold-load-time.ts')) };
const identityPath = `${out}/identity.json`;
if (process.env.LOAD_RESUME === '1' && existsSync(identityPath)) assert.deepEqual(JSON.parse(readFileSync(identityPath, 'utf8')), identity, 'resume requires the same source and build');
if (process.env.LOAD_RESUME === '1' && existsSync(`${out}/sweep.json`)) assert.ok(JSON.parse(readFileSync(`${out}/sweep.json`, 'utf8')).rows.every(row => row.revision === revision), 'resume requires the same source revision');
writeFileSync(identityPath, JSON.stringify(identity, null, 2));
const rows = [];
for (const level of selectedLevels.split(',')) for (const quality of selectedTiers.split(',')) {
  assert.match(level, /^L(?:[1-9]|10)$/);
  assert.ok(['high', 'low'].includes(quality));
  if (!(process.env.LOAD_RESUME === '1' && existsSync(`${out}/${level}-webgpu-${quality}-summary.json`))) {
    const log = openSync(`${out}/${level}-${quality}.log`, 'w');
    const child = spawn('sh', ['tools/perf/quiet-run.sh', process.execPath, '--import', 'tsx', 'tools/perf/cold-load-time.ts', origin, 'webgpu', quality, '5', level, '0'], {
      env: { ...process.env, LOAD_OUT: out, LOAD_FRESH_BROWSER: '1', LOAD_GAMEPLAY_MS: process.env.LOAD_GAMEPLAY_MS ?? '10000', LOAD_GAMEPLAY_LAST: '1', PERF_CONDITIONS_LOG: `${out}/conditions.jsonl` },
      stdio: ['ignore', log, log],
    });
    const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', value => done(value ?? 1)); });
    closeSync(log);
    assert.equal(code, 0, `${level}/${quality}: see ${out}/${level}-${quality}.log`);
  }
  const summary = JSON.parse(readFileSync(`${out}/${level}-webgpu-${quality}-summary.json`, 'utf8'));
  const samples = Array.from({ length: 5 }, (_, run) => JSON.parse(readFileSync(`${out}/${level}-webgpu-${quality}-${run}.json`, 'utf8')));
  assert.equal(summary.n, 5);
  assert.deepEqual(summary.errors, []);
  assert.ok(samples.every(s => s.freshBrowser && !s.diagnostic && s.settingsQuality === quality));
  assert.equal(new Set(samples.map(s => s.diskCache)).size, 5, 'every sample must use a fresh profile/cache');
  assert.ok(samples.every(s => s.origin === origin && s.level === level && s.quality === quality && new URL(s.bundle).pathname === entry), 'sample source and configuration must match');
  assert.ok(samples.every(s => s.contexts.includes('webgpu') && !s.contexts.includes('webgl2')));
  assert.ok(samples.every(s => s.adapter?.architecture === 'metal-3' && s.adapter?.fallback === false));
  rows.push({ revision, ...summary, budgetMs: level === 'L1' ? 3500 : 6000 });
  writeFileSync(`${out}/sweep.json`, JSON.stringify({
    method: 'Unchanged cold-load-time.ts: five fresh headless Chrome profiles/cache directories per row; native Metal WebGPU, 1600x900 DPR1, real level-select click to loading-card closure/Begin availability; exclusive quiet-run per row; no menu wait. OS/driver caches remain shared.',
    rows,
  }, null, 2));
  console.log(JSON.stringify({ level, quality, median: summary.median, max: summary.max, maxFrameMs: summary.maxFrameMs }));
}
