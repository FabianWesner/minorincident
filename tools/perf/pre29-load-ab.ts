/** L8/L10 dressing acceptance: run after gameplay checks, under quiet-run.sh.
 * cold-load-time.ts uses launchBrowser; children retain the exclusive pool token.
 * Usage: tsx tools/perf/pre29-load-ab.ts <batch28-origin> <current-origin>
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

assert.equal(process.env.MI_PERF_LOCK_HELD, '1', 'Use tools/perf/quiet-run.sh');
const [baseline, current] = process.argv.slice(2);
assert.ok(baseline && current, 'Supply baseline and current preview origins');
const out = process.env.PRE29_LOAD_OUT ?? 'test-results/pre29-checks/load';
mkdirSync(out, { recursive: true });
interface Sample {
  ms: number; errors: string[]; contexts: string[];
  adapter: { vendor: string; fallback: boolean };
  resources: { name: string; bytes: number }[]; bundle: string;
}
const rows: { level: string; quality: string; variant: string; run: number; sample: Sample }[] = [];
for (const quality of ['low', 'high']) for (const level of ['L8', 'L10']) {
  const n = quality === 'low' ? 5 : 1;
  for (let run = 0; run < n; run++) {
    const order = run % 2 ? [['current', current], ['baseline', baseline]] : [['baseline', baseline], ['current', current]];
    for (const [variant, origin] of order) {
      const dir = `${out}/${level}-${quality}/${variant}-${run}`;
      mkdirSync(dir, { recursive: true });
      const log = execFileSync(process.execPath, ['--import', 'tsx', 'tools/perf/cold-load-time.ts', origin, 'webgpu', quality, '1', level], {
        env: { ...process.env, LOAD_OUT: dir, LOAD_TRACE: '0', LOAD_ASSERT: '0' }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
      });
      writeFileSync(`${dir}/command.log`, log);
      const sample = JSON.parse(readFileSync(`${dir}/${level}-webgpu-${quality}-0.json`, 'utf8')) as Sample;
      assert.deepEqual(sample.errors, []);
      assert.ok(sample.contexts.includes('webgpu'));
      assert.equal(sample.adapter.fallback, false);
      rows.push({ level, quality, variant, run, sample });
      writeFileSync(`${out}/rows.json`, JSON.stringify(rows));
      console.log(`${level} ${quality} ${variant} ${run + 1}/${n}: ${sample.ms.toFixed(1)} ms`);
    }
  }
}
const summaries = ['low', 'high'].flatMap(quality => ['L8', 'L10'].map(level => {
  const variants = Object.fromEntries(['baseline', 'current'].map(variant => {
    const selected = rows.filter(r => r.level === level && r.quality === quality && r.variant === variant);
    const samples = selected.map(r => r.sample.ms).sort((a, b) => a - b);
    return [variant, { n: samples.length, median: samples[Math.floor(samples.length / 2)], samples,
      bytes: selected.map(r => r.sample.resources.reduce((sum, resource) => sum + resource.bytes, 0)) }];
  }));
  return { level, quality, ...variants, changePercent: 100 * (variants.current.median / variants.baseline.median - 1) };
}));
writeFileSync(`${out}/summary.json`, JSON.stringify({
  method: 'Alternating paired cold menu loads, fresh empty contexts, native Metal WebGPU, one exclusive quiet-run reservation; low n=5 medians, high n=1; no profiler',
  baselineRevision: '763b56c876f1245cc21372723e3b30405497f4f2',
  currentRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), summaries,
  currentRuntimeRevision: process.env.PRE29_RUNTIME_REVISION ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
}, null, 2));
console.log(JSON.stringify(summaries));
for (const row of summaries) assert.ok(row.changePercent <= 5, `${row.level} ${row.quality}: +${row.changePercent.toFixed(2)}% exceeds +5%`);
