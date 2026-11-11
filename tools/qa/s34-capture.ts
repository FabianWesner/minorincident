/** Matched audit captures. Run through tools/e2e-lock.sh with SCENE_PORT=4928.
 * S34_SIDE=before|after S34_TIER=low|high S34_BACKEND=webgl2|webgpu
 * S34_TYPES=nurse,crawler,dog (comma-separated r31 game fixture names).
 * Before uses Git source overrides in Vite; no checkout or simulation edits.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { SceneSession, readSpec, port, type Backend } from '../scenelab/session';
import { runSpec } from '../scenelab/run';

const side = process.env.S34_SIDE ?? 'after', tier = process.env.S34_TIER ?? 'low';
const backend = process.env.S34_BACKEND ?? 'webgl2';
if (!['before', 'after'].includes(side) || !['low', 'high'].includes(tier) || !['webgl2', 'webgpu'].includes(backend)) throw new Error('Invalid capture selection');
if (port !== 4928) throw new Error('S34 requires SCENE_PORT=4928');
const baseline = execFileSync('git', ['rev-parse', 'e2db4c7e^'], { encoding: 'utf8' }).trim();
const paths = execFileSync('git', ['diff', '--name-only', baseline, 'e2db4c7e', '--', 'src/render'], { encoding: 'utf8' }).trim().split('\n');
const originals = new Map(paths.map(path => [resolve(path), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })]));
const captureVersion = hashCapture();
function hashCapture() { return createHash('sha256').update(paths.map(path => side === 'before' ? originals.get(resolve(path))! : readFileSync(path, 'utf8')).join('') + readFileSync('src/debug/scenelab/SceneLab.ts', 'utf8') + 'walk30-120-attack298-346-hit420-450-v3').digest('hex'); }
const out = `test-results/s34-pairs/${side}-${backend}-${tier}`;
mkdirSync(out, { recursive: true });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
writeFileSync(`${out}/sources.json`, JSON.stringify({ side, baseline, paths: paths.map(path => ({ path, before: hash(originals.get(resolve(path))!), after: hash(readFileSync(path, 'utf8')) })) }, null, 2));
const server = await createServer({ configFile: resolve('vite.config.ts'), cacheDir: `/private/tmp/s34-vite-${side}`,
  plugins: side === 'before' ? [{ name: 's34-before', enforce: 'pre', load(id) { return originals.get(id.split('?')[0]); } }] : [],
  server: { host: '127.0.0.1', port, strictPort: true } });
const session = new SceneSession({ backend: backend as Backend, tier: tier as 'low' | 'high' });
const shots = [30, 60, 90, 120, 298, 314, 330, 346, 420, 432, 438, 450];
const results: unknown[] = [];
try {
  await server.listen(); await session.open();
  for (const type of (process.env.S34_TYPES ?? 'nurse,crawler,dog').split(',')) for (const [mood, time] of [['day', 'L1'], ['night', 'L8-zoo']] as const) {
    if (!/^[a-z0-9-]+$/.test(type)) throw new Error('Invalid fixture name');
    const spec = readSpec(resolve(`specs/scenes/r31-zombie-audit/game/${type}.json`));
    spec.name = `${type}-${mood}`; spec.time = time;
    if (existsSync(`${out}/${spec.name}/source-version.txt`) && readFileSync(`${out}/${spec.name}/source-version.txt`, 'utf8') === captureVersion && shots.every(frame => existsSync(`${out}/${spec.name}/shot-${String(frame).padStart(4, '0')}.png`)) && existsSync(`${out}/${spec.name}/metrics.json`)) {
      const previous = JSON.parse(readFileSync(`${out}/${spec.name}/metrics.json`, 'utf8')) as { checks: { pass: boolean } };
      if (previous.checks.pass) { console.log(`Already captured ${spec.name}`); continue; }
    }
    if (!session.isOpen) await session.open();
    const result = await runSpec(session, spec, { out: `${out}/${spec.name}`, shots });
    if (result.pass) writeFileSync(`${out}/${spec.name}/source-version.txt`, captureVersion);
    results.push({ name: spec.name, pass: result.pass, failed: result.failed });
    writeFileSync(`${out}/index.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
  }
} finally { await session.close(); await server.close(); }
if (results.some(row => !(row as { pass: boolean }).pass)) process.exitCode = 1;
