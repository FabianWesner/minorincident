/** Five paired cold loads for the L9 fix and its L1/L10 controls.
 * cold-load-time.ts uses launchBrowser; each child keeps this reservation's pool token.
 * sh tools/perf/quiet-run.sh node --import tsx tools/perf/l9-load-ab.ts <main-origin> <fix-origin>
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
if (process.env.MI_PERF_LOCK_HELD !== '1') throw Error('Use tools/perf/quiet-run.sh');
const [main, fix] = process.argv.slice(2);
assert.ok(main && fix, 'Supply main and fix preview origins');
const out = process.env.L9_LOAD_OUT ?? 'test-results/l9-load/quiet-load';
mkdirSync(out, { recursive: true });
const cases = [
  ['L1', 'webgpu', 'low'], ['L9', 'webgpu', 'low'], ['L10', 'webgpu', 'low'],
  ['L9', 'webgpu', 'high'], ['L9', 'webgl2', 'low'],
].filter(row => !process.env.L9_LOAD_CASES || process.env.L9_LOAD_CASES.split(',').includes(row.join('-')));
assert.ok(cases.length, 'Select at least one load case');
interface Sample {
  ms: number; errors: string[]; adapter: { vendor: string; fallback: boolean } | null; contexts: string[];
  glRenderer: string | null; resources: { name: string; bytes: number }[];
  measures: { name: string; at: number; ms: number }[]; bundle: string;
}
const rows: { case: string; variant: string; run: number; sample: Sample }[] = [];
for (const [level, backend, quality] of cases) for (let run = 0; run < 5; run++) {
  const order = run % 2 ? [['fix', fix], ['main', main]] : [['main', main], ['fix', fix]];
  for (const [variant, origin] of order) {
    const name = [level, backend, quality].join('-'), dir = `${out}/${name}/${variant}-${run}`;
    mkdirSync(dir, { recursive: true });
    const log = execFileSync(process.execPath, ['--import', 'tsx', 'tools/perf/cold-load-time.ts', origin, backend, quality, '1', level], {
      env: { ...process.env, LOAD_OUT: dir, LOAD_TRACE: '0', LOAD_ASSERT: '0' }, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    });
    writeFileSync(`${dir}/command.log`, log);
    const sample = JSON.parse(readFileSync(`${dir}/${name}-0.json`, 'utf8')) as Sample;
    assert.deepEqual(sample.errors, []);
    assert.ok(sample.contexts.includes(backend === 'webgpu' ? 'webgpu' : 'webgl2'));
    if (backend === 'webgpu') assert.equal(sample.adapter?.fallback, false);
    rows.push({ case: name, variant, run, sample });
    console.log(`${name} ${variant} ${run + 1}/5: ${sample.ms.toFixed(1)} ms`);
    writeFileSync(`${out}/rows.json`, JSON.stringify(rows));
  }
}
const summaries = Object.fromEntries(cases.map(c => {
  const name = c.join('-');
  return [name, Object.fromEntries(['main', 'fix'].map(variant => {
    const samples = rows.filter(r => r.case === name && r.variant === variant).map(r => r.sample.ms).sort((a, b) => a - b);
    return [variant, { n: samples.length, median: samples[2], min: samples[0], max: samples[4], samples }];
  }))];
}));
writeFileSync(`${out}/summary.json`, JSON.stringify({ method: 'Five paired alternating cold menu loads per case, isolated empty context per sample, native Metal, one exclusive quiet-run reservation; no profiler', mainRevision: process.env.L9_MAIN_REVISION, fixRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), summaries }, null, 2));
console.log(JSON.stringify(summaries));
if (summaries['L9-webgpu-low']) assert.ok(summaries['L9-webgpu-low'].fix.median <= 6000, 'L9 cold median exceeds 6.0 s');
