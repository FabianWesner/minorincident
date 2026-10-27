// Run from a clean checkout so every step exercises the shared dist cache.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

assert.equal(spawnSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).stdout.trim(), '', 'Commit changes before checking cached builds');
const out = 'test-results/build-cache-check';
mkdirSync(out, { recursive: true });
const base = { ...process.env, NODE_ENV: 'production', BRANCH: 'production', VITE_QA_HOOKS: '0', MI_BUILD_CACHE: 'on' };
delete base.BUILD_SPIKES;
const results = [];
for (const [label, command, hooks, overrides, reused] of [
  ['prod-first', ['npm', 'run', 'build'], false, {}, false],
  ['qa', ['npm', 'run', 'build:qa'], true, { VITE_QA_HOOKS: '1' }, false],
  ['prod-restored', ['npm', 'run', 'build'], false, {}, true],
  ['branch-qa', ['npm', 'run', 'build'], true, { BRANCH: 'qa' }, false],
  ['prod-after-branch', ['npm', 'run', 'build'], false, {}, true],
  ['development-env', ['sh', 'tools/build-cached.sh'], true, { NODE_ENV: 'development' }, false],
  ['prod-after-development', ['npm', 'run', 'build'], false, {}, true],
]) {
  const env = { ...base, ...overrides }, started = performance.now();
  const build = spawnSync(command[0], command.slice(1), { env, encoding: 'utf8' });
  const log = `${build.stdout ?? ''}${build.stderr ?? ''}`;
  writeFileSync(`${out}/${label}.log`, log);
  assert.equal(build.status, 0, `${label}: ${log}`);
  if (reused) assert.match(log, /Reused production dist/, `${label} must restore cached PROD`);
  const config = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "import config from './vite.config.ts'; console.log(config.define.__QA_HOOKS__);"], { env, encoding: 'utf8' });
  assert.equal(config.status, 0, config.stderr);
  assert.equal(config.stdout.trim(), String(hooks), `${label}: __QA_HOOKS__`);
  const files = readdirSync('dist', { recursive: true }).map(String);
  assert.deepEqual(files.filter(p => p.endsWith('.html')).sort(), hooks ? ['index.html', 'perf-device.html', 'preview/index.html'] : ['index.html'], `${label}: public QA pages`);
  const bundle = files.filter(p => /\.(?:js|html)$/.test(p)).map(p => readFileSync(`dist/${p}`, 'utf8')).join('\n');
  for (const marker of ['__SS__', '__SCENE__', '__MOTIONLAB__', '__ASSET__', 'testApi', 'SceneLab', 'MotionLab']) assert.equal(bundle.includes(marker), hooks, `${label}: emitted ${marker}`);
  const row = { label, command, nodeEnv: env.NODE_ENV, branch: env.BRANCH, qaHooks: hooks, cacheHit: /Reused production dist/.test(log), durationMs: Math.round(performance.now() - started) };
  results.push(row);
  console.log(`PASS ${label}: __QA_HOOKS__=${hooks}, cacheHit=${row.cacheHit}`);
}
writeFileSync(`${out}/results.json`, JSON.stringify({ revision: spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim(), results }, null, 2) + '\n');
