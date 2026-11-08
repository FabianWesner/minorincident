/** Native accepted-view A/B for the shadow-only source fix. Always restores the repaired shader. */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const baseline = process.env.E25_BEFORE_REF ?? '63814503';
const beforeOnly = process.argv.includes('--before-only'), afterOnly = process.argv.includes('--after-only');
if (beforeOnly && afterOnly) throw Error('Choose only one capture phase');
const source = 'src/render/PaletteMaterial.ts', repaired = readFileSync(source);
const temp = mkdtempSync(join(tmpdir(), 'e25-rest-')), fixture = join(temp, 'fixtures.json');
writeFileSync(fixture, '[]\n');
const capture = (phase: string) => {
  // Built artifacts avoid dev-server HMR during long native-level captures.
  execFileSync('npm', ['run', 'build:qa'], { stdio: 'inherit' });
  for (const tier of ['high', 'low']) execFileSync(process.execPath, ['--import', 'tsx', 'tools/qa/e25-emitter-visual.ts', ...(tier === 'low' ? ['--low'] : [])], {
    stdio: 'inherit', env: { ...process.env, SCENE_SERVER: 'preview', E25_BEFORE_REF: baseline, E25_FIXTURE_FILE: fixture, E25_SETTLE_ROUNDS: '20', E25_RESET_POSE_HISTORY: '1', E25_OUT: `test-results/epics/E25/rest/settled-${phase}` },
  });
};
try {
  if (!afterOnly) {
    try { writeFileSync(source, execFileSync('git', ['show', `${baseline}:${source}`])); capture('before'); }
    finally { writeFileSync(source, repaired); }
  }
  if (!beforeOnly) capture('after');
} finally {
  writeFileSync(source, repaired); rmSync(temp, { recursive: true, force: true });
  console.log('Restored shader SHA256:', createHash('sha256').update(readFileSync(source)).digest('hex'));
}
