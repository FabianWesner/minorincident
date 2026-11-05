import { execFileSync, spawnSync } from 'node:child_process';

// The runner's private job has an index/manifest but no Git commits or refs.
// Capture provenance in the source worktree and pass it through run.sh's supported env transport.
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const revision = git('rev-parse', 'HEAD'), main = git('rev-parse', 'refs/heads/main');
const same = git('diff', main, '--', 'src', 'public') === '' && git('ls-files', '--others', '--exclude-standard', '--', 'src', 'public') === '';
const result = spawnSync('sh', [
  'tools/remote/run.sh', process.cwd(), '--pull', 'test-results/qa-threat',
  '--env', `QA_THREAT_REVISION=${revision}`, '--env', `QA_THREAT_MAIN_REVISION=${main}`, '--env', `QA_THREAT_SOURCE_MATCHES_MAIN=${same}`,
  '--', 'npm', 'run', 'qa:threat', '--', '--maxWorkers=2', ...process.argv.slice(2),
], { stdio: 'inherit' });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
