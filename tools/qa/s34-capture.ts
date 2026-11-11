/** Matched audit captures. Run through tools/e2e-lock.sh with SCENE_PORT=4928.
 * S34_SIDE=before|after S34_TIER=low|high S34_BACKEND=webgl2|webgpu
 * S34_TYPES=nurse,crawler,dog (comma-separated r31 game fixture names).
 * Optional S34_BURST=1 isolates initial MG; S34_MOVING=1 selects a moving attack; S34_CLOSE=1 uses the original close fixture.
 * Before uses Git source overrides in Vite; no checkout or simulation edits.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { SceneSession, readSpec, port, type Backend } from '../scenelab/session';
import { runSpec } from '../scenelab/run';
import type { Game } from '../../src/Game';

const side = process.env.S34_SIDE ?? 'after', tier = process.env.S34_TIER ?? 'low';
const backend = process.env.S34_BACKEND ?? 'webgl2', burst = process.env.S34_BURST === '1', movingOnly = process.env.S34_MOVING === '1', close = process.env.S34_CLOSE === '1';
if (burst && movingOnly) throw new Error('Choose burst or moving capture');
if (!['before', 'after'].includes(side) || !['low', 'high'].includes(tier) || !['webgl2', 'webgpu'].includes(backend)) throw new Error('Invalid capture selection');
if (port !== 4928) throw new Error('S34 requires SCENE_PORT=4928');
const baseline = execFileSync('git', ['rev-parse', 'e2db4c7e^'], { encoding: 'utf8' }).trim();
const paths = execFileSync('git', ['diff', '--name-only', baseline, 'e2db4c7e', '--', 'src/render'], { encoding: 'utf8' }).trim().split('\n');
const originals = new Map(paths.map(path => [resolve(path), execFileSync('git', ['show', `${baseline}:${path}`], { encoding: 'utf8' })]));
const captureVersion = hashCapture();
function hashCapture() { return createHash('sha256').update(paths.map(path => side === 'before' ? originals.get(resolve(path))! : readFileSync(path, 'utf8')).join('') + readFileSync('src/debug/scenelab/SceneLab.ts', 'utf8') + 'sim-aligned-windows-v4').digest('hex'); }
const out = `test-results/s34-pairs/${side}-${backend}-${tier}${burst ? '-burst' : movingOnly ? '-moving' : ''}${close ? '-close' : ''}`;
mkdirSync(out, { recursive: true });
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
writeFileSync(`${out}/sources.json`, JSON.stringify({ side, baseline, paths: paths.map(path => ({ path, before: hash(originals.get(resolve(path))!), after: hash(readFileSync(path, 'utf8')) })) }, null, 2));
const server = await createServer({ configFile: resolve('vite.config.ts'), cacheDir: `/private/tmp/s34-vite-${side}`,
  plugins: side === 'before' ? [{ name: 's34-before', enforce: 'pre', load(id) { return originals.get(id.split('?')[0]); } }] : [],
  server: { host: '127.0.0.1', port, strictPort: true } });
const session = new SceneSession({ backend: backend as Backend, tier: tier as 'low' | 'high' });
interface CaptureWindows { walk: number[]; attack: number[]; hit: number[]; sustained?: number[]; melee?: number[]; heavy?: number[]; started: number; strike: number; movingEvidence?: { frame: number; speed: number } }
const windowsRoot = 'test-results/s34-windows';
mkdirSync(windowsRoot, { recursive: true });
const results: unknown[] = [];
try {
  await server.listen(); await session.open();
  for (const type of (process.env.S34_TYPES ?? 'nurse,crawler,dog').split(',')) for (const [mood, time] of [['day', 'L1'], ['night', 'L8-zoo']] as const) {
    if (!/^[a-z0-9-]+$/.test(type)) throw new Error('Invalid fixture name');
    const spec = readSpec(resolve(`specs/scenes/r31-zombie-audit/${close ? '' : 'game/'}${type}.json`));
    spec.name = `${type}-${mood}`; spec.time = time;
    if (burst) {
      // Isolate living MG responses using the same gun and unmodified infected stats.
      spec.script = spec.script?.filter(row => row.frame === 120 || row.frame === 420).map(row => row.frame === 420 && 'do' in row && typeof row.do === 'object' && 'attack' in row.do ? { ...row, do: { ...row.do, seconds: 3 } } : row);
      spec.frames = 480;
    }
    const windowsPath = `${windowsRoot}/${close ? 'close-' : ''}${burst ? 'burst-' : movingOnly ? 'moving-' : ''}${spec.name}.json`;
    if (burst) writeFileSync(windowsPath, JSON.stringify({ walk: [], attack: [], hit: [420, 428, 430, 432], sustained: [430, 432, 434, 436, 438, 440, 442, 444], started: 428, strike: 428 }));
    if (!existsSync(windowsPath)) {
      await session.load(spec);
      const timing = await session.page.evaluate(async ({ archetype, movingOnly }) => {
        const lab = window.__SCENE__!, world = (lab as unknown as { game: Game }).game.world;
        const attacks: { started: number; strike: number }[] = [], movingAttacks: { started: number; strike: number; speed: number; movingAt: number }[] = []; let moving = 0, previous = '', lastAttack: { started: number; strike: number } | undefined;
        for (let frame = 1; frame <= 510; frame++) {
          await lab.step(1);
          const e = world.infected!.active.find(e => e.archetype === archetype)!;
          if (!moving && (e.motion?.speed ?? 0) > .2) moving = frame;
          if (e.infected?.state === 'attack' && previous !== 'attack' && !e.infected.specialAttack && e.infected.until + 24 < 510) { lastAttack = { started: frame, strike: e.infected.until }; attacks.push(lastAttack); }
          if (lastAttack && frame < 420 && frame < lastAttack.strike + 24 && (e.motion?.speed ?? 0) > .06) movingAttacks.push({ ...lastAttack, movingAt: frame, speed: e.motion!.speed });
          previous = e.infected?.state ?? '';
        }
        const movingAttack = movingAttacks.find(a => a.speed > .5 && a.movingAt < a.strike - 4) ?? movingAttacks.find(a => a.speed > .5) ?? movingAttacks[0];
        const attack = movingOnly ? movingAttack : attacks.find(a => a.started >= 180 && a.strike + 24 < 420) ?? attacks.find(a => a.started >= 180) ?? attacks[0];
        if (!moving || !attack) throw new Error(`No walk/ordinary attack window for ${archetype}`);
        return { moving, ...attack, movingEvidence: movingOnly && movingAttack ? { frame: movingAttack.movingAt, speed: movingAttack.speed } : undefined };
      }, { archetype: spec.actors?.find(a => a.kind === 'infected')?.archetype ?? 'infected.runner', movingOnly });
      const movingAt = timing.movingEvidence?.frame ?? timing.started;
      const windows: CaptureWindows = { walk: [10, 20, 30, 40].map(offset => timing.moving + offset), attack: movingOnly ? movingAt < timing.strike ? [timing.started, movingAt, Math.min(movingAt + 4, timing.strike - 1), timing.strike + 8, timing.strike + 24] : [timing.started, timing.strike - 1, movingAt, Math.min(movingAt + 4, timing.strike + 26), timing.strike + 26] : [timing.started, timing.strike - 1, timing.strike + 8, timing.strike + 24], hit: [420, 432, 438, 450], started: timing.started, strike: timing.strike, movingEvidence: timing.movingEvidence };
      writeFileSync(windowsPath, JSON.stringify(windows, null, 2));
    }
    const windows = JSON.parse(readFileSync(windowsPath, 'utf8')) as CaptureWindows;
    if (close) { windows.melee = [510, 517, 522, 528]; windows.heavy = [600, 606, 618, 636]; }
    const shots = [...new Set([...windows.walk, ...windows.attack, ...windows.hit, ...(windows.sustained ?? []), ...(windows.melee ?? []), ...(windows.heavy ?? [])])].sort((a, b) => a - b);
    if (existsSync(`${out}/${spec.name}/source-version.txt`) && readFileSync(`${out}/${spec.name}/source-version.txt`, 'utf8') === captureVersion && shots.every(frame => existsSync(`${out}/${spec.name}/shot-${String(frame).padStart(4, '0')}.png`)) && existsSync(`${out}/${spec.name}/metrics.json`)) {
      const previous = JSON.parse(readFileSync(`${out}/${spec.name}/metrics.json`, 'utf8')) as { checks: { pass: boolean } };
      if (previous.checks.pass) { console.log(`Already captured ${spec.name}`); continue; }
    }
    if (!session.isOpen) await session.open();
    const result = await runSpec(session, spec, { out: `${out}/${spec.name}`, shots });
    writeFileSync(`${out}/${spec.name}/windows.json`, JSON.stringify(windows, null, 2));
    if (result.pass) writeFileSync(`${out}/${spec.name}/source-version.txt`, captureVersion);
    results.push({ name: spec.name, pass: result.pass, failed: result.failed });
    writeFileSync(`${out}/index.json`, JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results.at(-1)));
  }
} finally { await session.close(); await server.close(); }
if (results.some(row => !(row as { pass: boolean }).pass)) process.exitCode = 1;
