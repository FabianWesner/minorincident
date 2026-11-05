/** Fresh shipped-allocator comparison: 100 s L1 outbreak, 240 s L4 war, or the full frozen L5 completion. */
import { deepStrictEqual, equal } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { withLegacyPropIds } from '../sim-runner/propVariants';

const level = process.argv[2] as 'L1' | 'L4' | 'L5';
if (!['L1', 'L4', 'L5'].includes(level)) throw new Error('Usage: node --import tsx/esm tools/qa/prop-invariance.ts L1|L4|L5');
const seconds = level === 'L1' ? 100 : level === 'L4' ? 240 : 600;
const rows: object[] = [];
let baseline: object | undefined;
let baselineDiagnostic: object | undefined;
try {
  for (const [mode, props] of [['main', 0], ['candidate', 0], ...level === 'L5' ? [] : [['candidate', -4], ['candidate', 4]]] as ['main' | 'candidate', -4 | 0 | 4][]) {
    const run = () => runLevel(level, 'complete', 1, seconds, 'auto', undefined, undefined, props);
    const report = mode === 'main' ? await withLegacyPropIds(run) : await run();
    // Geometry/query diagnostics include the deliberately different prop population. The outcome retains
    // exact mission timing, objective progress, damage, deaths, kills and failures; raw positions remain in the receipt.
    const { collision, blocker, ...outcome } = report;
    equal(collision?.failures, 0, 'collision invariant');
    const hash = createHash('sha256').update(JSON.stringify(outcome)).digest('hex').slice(0, 16);
    const row = { mode, props, seconds, hash, ...outcome, blocker };
    rows.push(row); console.log(JSON.stringify(row));
    if (mode === 'main') { baseline = outcome; baselineDiagnostic = report; }
    else {
      deepStrictEqual(outcome, baseline, `${level}/${props}: gameplay outcome differs from main`);
      if (props === 0) deepStrictEqual(report, baselineDiagnostic, `${level}: unchanged layout differs from main`);
    }
  }
} finally {
  mkdirSync('test-results/prop-invariance', { recursive: true });
  writeFileSync(`test-results/prop-invariance/${level}.json`, JSON.stringify(rows, null, 2) + '\n');
}
