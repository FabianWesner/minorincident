/** Restore exactly the changed public GLBs/table/bake manifest for one baseline capture; always restore repairs. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const baseline = process.env.E25_BEFORE_REF ?? 'ac0a9e26';
const afterOnly = process.argv.includes('--after-only');
const paths = execFileSync('git', ['diff', '--name-only', baseline, '--', 'public/assets/models'], { encoding: 'utf8' }).trim().split('\n').filter(p => p.endsWith('.glb'));
paths.push('src/data/lightAnchors.json', 'src/assets/staticBakes.json');
const repaired = new Map<string, Buffer>(afterOnly ? [] : paths.map(path => [path, readFileSync(path)] as const));
const capture = (phase: string) => {
  for (const tier of ['high', 'low']) execFileSync(process.execPath, ['--import', 'tsx/esm', 'tools/qa/e25-emitter-visual.ts', ...(tier === 'low' ? ['--low'] : [])], {
    stdio: 'inherit', env: { ...process.env, E25_BEFORE_REF: baseline, E25_FIXTURE_FILE: 'docs/reports/e25-emitters/evidence/visual-fixtures.json', E25_OUT: `test-results/epics/E25/emitters-${phase}` },
  });
};
if (afterOnly) {
  const fixtures = JSON.parse(readFileSync('docs/reports/e25-emitters/evidence/visual-fixtures.json', 'utf8')) as unknown[];
  for (const tier of ['high', 'low']) {
    const rows = JSON.parse(readFileSync(`test-results/epics/E25/emitters-before/${tier}/captures.json`, 'utf8')) as { tier: string; errors: string[]; path: string; sha256: string }[];
    if (rows.length !== fixtures.length * 2 + 8 || rows.some(r => r.tier !== tier || r.errors.length || createHash('sha256').update(readFileSync(r.path)).digest('hex') !== r.sha256)) throw Error(`Incomplete or changed ${tier} baseline`);
  }
} else {
  try {
    for (const path of paths) writeFileSync(path, execFileSync('git', ['show', `${baseline}:${path}`], { maxBuffer: 64 * 1024 * 1024 }));
    capture('before');
  } finally { for (const [path, bytes] of repaired) writeFileSync(path, bytes); }
}
capture('after');
