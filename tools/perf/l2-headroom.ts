import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Run under tools/e2e-lock.sh: one native browser at a time, with the original test unchanged.
const base = 'test-results/epics/E20/perf', summaries = [];
for (let run = 1; run <= 3; run++) {
  const dir = `${base}/run-${run}`; mkdirSync(dir, { recursive: true });
  const result = spawnSync('npx', ['playwright', 'test', 'tests/perf/l2-budgets.spec.ts', '--project=chromium', '--workers=1'], { stdio: 'inherit' });
  const failures: string[] = [];
  for (const tier of ['high', 'low'] as const) {
    for (const file of [`l2-${tier}.json`, `l2-collapse-${tier}.png`]) copyFileSync(`${base}/${file}`, `${dir}/${file}`);
    const proof = JSON.parse(readFileSync(`${dir}/l2-${tier}.json`, 'utf8'));
    const limits = { drawCalls: tier === 'high' ? 540 : 270, triangles: tier === 'high' ? 1_350_000 : 450_000, revealMaxMs: 45, gateMaxMs: 45, [tier === 'high' ? 'peakP95' : 'peakP50']: tier === 'high' ? 12.6 : 30 };
    for (const [metric, limit] of Object.entries(limits)) {
      if (!Number.isFinite(proof[metric])) failures.push(`${tier} ${metric}: missing or invalid measurement`);
      else if (proof[metric] > limit) failures.push(`${tier} ${metric}: ${proof[metric]} > ${limit}`);
    }
    summaries.push({ run, tier, ...Object.fromEntries(Object.keys(limits).map(key => [key, proof[key]])) });
  }
  copyFileSync('test-results/playwright/results.json', `${dir}/playwright.json`);
  writeFileSync(`${base}/headroom.json`, JSON.stringify({ summaries, failures, nativeExit: result.status }, null, 2));
  if (result.status !== 0 || failures.length) throw new Error(`Run ${run} failed: native exit ${result.status}; ${failures.join('; ')}`);
}
console.log('Both native cases passed three consecutive runs with at least 10% headroom on every maximum gate.');
