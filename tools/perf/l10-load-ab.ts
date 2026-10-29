/** Q-228: five paired cold menu loads per build, alternating order, in one quiet-run reservation.
 * sh tools/perf/quiet-run.sh npx tsx tools/perf/l10-load-ab.ts <main-origin> <candidate-origin>
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
if (process.env.MI_PERF_LOCK_HELD !== '1') throw Error('Use tools/perf/quiet-run.sh');
const [main, candidate] = process.argv.slice(2);
assert.ok(main && candidate, 'Supply main and candidate preview origins');
const out = process.env.L10_LOAD_OUT ?? 'test-results/l10-perf/quiet-load'; mkdirSync(out, { recursive: true });
interface Sample { ms: number; errors: string[]; adapter: { vendor: string; fallback: boolean }; contexts: string[]; resources: { name: string; bytes: number }[]; measures: { name: string; ms: number }[]; bundle: string }
const rows: { variant: string; run: number; ms: number; bytes: number; bundle: string; adapter: Sample['adapter']; measures: Sample['measures'] }[] = [];
for (let run = 0; run < 5; run++) {
  const order = run % 2 ? [['candidate', candidate], ['main', main]] : [['main', main], ['candidate', candidate]];
  for (const [variant, origin] of order) {
    const dir = `${out}/${variant}-${run}`; mkdirSync(dir, { recursive: true });
    const log = execFileSync(process.execPath, ['--import', 'tsx', 'tools/perf/cold-load-time.ts', origin, 'webgpu', 'low', '1', 'L10'], {
      env: { ...process.env, LOAD_OUT: dir, LOAD_TRACE: '0', LOAD_ASSERT: '0' }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(`${dir}/command.log`, log);
    const sample = JSON.parse(readFileSync(`${dir}/L10-webgpu-low-0.json`, 'utf8')) as Sample;
    assert.deepEqual(sample.errors, []); assert.ok(sample.contexts.includes('webgpu')); assert.equal(sample.adapter.fallback, false);
    rows.push({ variant, run, ms: sample.ms, bytes: sample.resources.reduce((sum, r) => sum + r.bytes, 0), bundle: sample.bundle, adapter: sample.adapter, measures: sample.measures.filter(m => /^(level:|view:|L1 shader)/.test(m.name)) });
    console.log(`${variant} ${run + 1}/5: ${sample.ms.toFixed(1)} ms`);
  }
}
const summaries = Object.fromEntries(['main', 'candidate'].map(variant => {
  const samples = rows.filter(r => r.variant === variant).map(r => r.ms).sort((a, b) => a - b);
  return [variant, { n: samples.length, median: samples[2], min: samples[0], max: samples[4], samples }];
}));
const result = { method: 'Paired alternating order, fresh isolated browser contexts, native Metal WebGPU low, real level menu click to loading-card closure; one exclusive quiet reservation', mainRevision: process.env.L10_MAIN_REVISION, candidateRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), summaries, rows };
writeFileSync(`${out}/summary.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(summaries));
assert.ok(summaries.candidate.median <= 5500, `L10 cold median ${summaries.candidate.median} ms exceeds 5.5 s`);
