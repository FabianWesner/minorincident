// Build the exact lane base or candidate in this worktree, without another checkout or retained dist copy.
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const variant = process.argv[2];
if (!['prod', 'candidate'].includes(variant)) throw new Error('Expected prod or candidate');
const paths = ['src/data/l5.ts', 'src/sim/missions/LevelFiveAftermath.ts', 'src/render/GameView.ts'];
const saved = paths.map(path => readFileSync(path));
try {
  if (variant === 'prod') for (const path of paths) writeFileSync(path, execFileSync('git', ['show', `32fff428b:${path}`]));
  const run = spawnSync('npm', ['run', 'build:qa'], { stdio: 'inherit', env: { ...process.env, MI_BUILD_CACHE: 'off' } });
  process.exitCode = run.status ?? 1;
  if (run.status === 0) writeFileSync(`test-results/l5-density/${variant}-build.json`, JSON.stringify({ variant, at: new Date().toISOString(), base: '32fff428b', sources: Object.fromEntries(paths.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')])), htmlSha256: createHash('sha256').update(readFileSync('dist/index.html')).digest('hex') }, null, 2));
} finally { if (variant === 'prod') paths.forEach((path, i) => writeFileSync(path, saved[i])); }
