/** Freeze node time and compare the exact accepted views before/after the metadata-only repairs. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const paths = (JSON.parse(readFileSync(process.env.E25_IDENTITY_FILE ?? 'docs/reports/e25-verify/evidence/anchor-glb-identity.json', 'utf8')) as { path: string }[]).map(r => r.path);
if (process.env.E25_AB_TABLE === '1') paths.push('src/data/lightAnchors.json');
const repaired = new Map(paths.map(path => [path, readFileSync(path)]));
try {
  for (const path of paths) writeFileSync(path, execFileSync('git', ['show', `${process.env.E25_BEFORE_REF ?? 'HEAD'}:${path}`], { maxBuffer: 64 * 1024 * 1024 }));
  execFileSync(process.execPath, ['--import', 'tsx/esm', 'tools/qa/e25-spot-audit.ts'], { stdio: 'inherit', env: { ...process.env, E25_OUT: `test-results/epics/E25/${process.env.E25_AB_PREFIX ?? 'frozen'}-before` } });
} finally { for (const [path, bytes] of repaired) writeFileSync(path, bytes); }
execFileSync(process.execPath, ['--import', 'tsx/esm', 'tools/qa/e25-spot-audit.ts'], { stdio: 'inherit', env: { ...process.env, E25_OUT: `test-results/epics/E25/${process.env.E25_AB_PREFIX ?? 'frozen'}-after` } });
