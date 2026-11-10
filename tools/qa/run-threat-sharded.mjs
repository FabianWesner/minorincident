// qa:threat across two runners. Each shard is a deterministic half of the stage list (longest-first onto 2 x 4 virtual
// workers, tools/qa/threat/stageJobs.ts), runs on its own runner under the unchanged 600 s test-budget, and the merge
// below rebuilds the normal audit.json / LevelN.json / README.md from both stage sets, so the gate result is the same.
//   node tools/qa/run-threat-sharded.mjs [--single] [extra threat-audit args]
// --single: run the audit locally without requiring remote runners.
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args.includes('--single')) {
  const r = spawnSync('node', ['--import', 'tsx/esm', 'tools/qa/threat-audit.ts', ...args.filter(a => a !== '--single')], { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD'), main = git('rev-parse', 'refs/heads/main');
const same = git('diff', main, '--', 'src', 'public') === '' && git('ls-files', '--others', '--exclude-standard', '--', 'src', 'public') === '';
const provenance = { QA_THREAT_REVISION: revision, QA_THREAT_MAIN_REVISION: main, QA_THREAT_SOURCE_MATCHES_MAIN: String(same) };
const count = 2, started = Date.now();
// RUNNER_SLOTS=1: a runner holding one shard is "full", so the second shard must land on a different runner (4 vCPUs each).
const shard = index => new Promise(resolve => {
  const out = `test-results/qa-threat-shard-${index + 1}`;
  const child = spawn('sh', ['tools/remote/run.sh', process.cwd(), '--pull', out,
    ...Object.entries(provenance).flatMap(([k, v]) => ['--env', `${k}=${v}`]),
    '--', 'node', 'tools/qa/test-budget.mjs', '--name', `qa-threat-shard-${index + 1}`, '--max-seconds', '600', '--',
    'node', '--import', 'tsx/esm', 'tools/qa/threat-audit.ts', '--shard', `${index + 1}/${count}`, '--out', out, ...args],
  { stdio: 'inherit', env: { ...process.env, RUNNER_SLOTS: '1' } });
  child.on('exit', code => resolve(code ?? 1));
});
const codes = await Promise.all(Array.from({ length: count }, (_, i) => shard(i)));
console.log(`[qa:threat:sharded] shards exited ${codes.join('/')} after ${((Date.now() - started) / 1000).toFixed(0)}s`);
if (codes.some(c => c !== 0)) process.exit(1);
const dirs = Array.from({ length: count }, (_, i) => `test-results/qa-threat-shard-${i + 1}`).join(',');
const merged = spawnSync('node', ['--import', 'tsx/esm', 'tools/qa/threat-audit.ts', '--merge', dirs, ...args], { stdio: 'inherit', env: { ...process.env, ...provenance } });
process.exit(merged.status ?? 1);
