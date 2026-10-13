import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { basename, relative, resolve } from 'node:path';
import { SceneSession, readSpec, stopServer, type Backend } from './session';
import { runSpec } from './run';
import type { SceneSpec } from '../../src/debug/scenelab/spec';
import { zoomLimits } from '../../src/render/View';

/** npm run scene:catalog [-- --filter <glob>] [--dir <scene directory>] [--jobs 2] [--backend webgl2|webgpu] [--tier high|low] [--matrix] [--size 960x540] [--out dir] [--list]
 * Runs the ready-made QA scenes in specs/scenes/catalog/ and tests/scenes/catalog/ (own specs, or `extends` of specs/scenes/*.json) headless with
 * at most `jobs` browsers (default 2, under tools/e2e-lock.sh), and writes <out>/index.md: one row per scene with the
 * gate results and the contact sheet (<out>/<scene>/sheet.jpg). The filter is a glob on the scene name, comma separated
 * (`bld-grove-*`, `fight-*,ped-*`). Exit 1 when any gate fails or a scene throws. Docs: docs/tools/scene-lab.md.
 * `--matrix` (PO 10-13 low tier / close zoom): every scene runs at the high and the low quality tier, and scenes with a
 * game/follow camera also at zoom 1 and the closest player zoom (`zoomLimits[0]`), as `<scene>@<tier>-z<zoom>` rows. */
const args = process.argv.slice(2), flag = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const dirs = (flag('dir') ? [resolve(flag('dir')!)] : [resolve('specs/scenes/catalog'), resolve('tests/scenes/catalog')]).filter(existsSync);
const out = resolve(flag('out') ?? 'test-results/scene-catalog');
const backend = (flag('backend') ?? 'webgl2') as Backend, matrix = args.includes('--matrix');
const tiers = (matrix ? ['high', 'low'] : [flag('tier') ?? 'high']) as ('high' | 'low')[];
const [width, height] = (flag('size') ?? '960x540').split('x').map(Number);
const jobs = Math.max(1, Math.min(2, Number(flag('jobs') ?? 2)));
const globs = (flag('filter') ?? '*').split(',').map(g => new RegExp(`^${g.trim().replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')}$`));

interface Entry { name: string; file: string; spec: SceneSpec; tier: 'high' | 'low' }
const zoomed = (spec: SceneSpec) => spec.camera?.mode === 'game' || spec.camera?.mode === 'follow';
const entries: Entry[] = dirs.flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort().map(f => {
  const file = `${dir}/${f}`, spec = readSpec(file);
  return { name: spec.name ?? basename(f, '.json'), file, spec };
})).filter(e => globs.some(g => g.test(e.name))).flatMap(e => tiers.flatMap(tier => {
  if (!matrix) return [{ ...e, tier }];
  // The camera override keeps the authored target/actor; closer zoom is what the player sees at the scroll limit.
  const zooms = zoomed(e.spec) ? [zoomLimits[1], 1, zoomLimits[0]] : [null];
  return zooms.map(zoom => ({ ...e, tier, name: `${e.name}@${tier}${zoom === null ? '' : `-z${zoom}`}`, spec: zoom === null ? e.spec : { ...e.spec, camera: { ...e.spec.camera!, zoom } as SceneSpec['camera'] } }));
}));
if (!entries.length) { console.error(`no catalog scene matches ${flag('filter')}; names: ${dirs.flatMap(dir => readdirSync(dir).filter(f => f.endsWith('.json')).map(f => basename(f, '.json'))).join(' ')}`); process.exit(2); }
if (args.includes('--list')) { console.log(entries.map(e => e.name).join('\n')); process.exit(0); }

type Row = { name: string; file: string; pass: boolean; seconds: number; frames: number; gates: string; failed: string[]; sheet?: string; sheetKb?: number; error?: string; errors: number; note?: string };
const rows: Row[] = [], started = Date.now();
const sessions: SceneSession[] = [];
let queue: Entry[] = [];
try {
  // The quality tier is fixed per browser: one pass per tier.
  for (const tier of tiers) {
  queue = entries.filter(e => e.tier === tier);
  // Open the browsers one after the other so only the first one starts the Vite server.
  for (let i = 0; i < Math.min(jobs, queue.length); i++) { const s = new SceneSession({ backend, tier, viewport: { width, height }, log: () => {} }); await s.open(); sessions.push(s); }
  console.error(`[catalog] ${queue.length} scenes, ${sessions.length} browser(s), ${width}x${height}, ${backend}, ${tier}`);
  await Promise.all(sessions.map(async session => {
    for (let e = queue.shift(); e; e = queue.shift()) {
      const dirName = `${out}/${e.name}`, t0 = Date.now();
      try {
        const spec = e.spec;
        // The catalog keeps no full-size PNGs (disk): only the sheet. Re-run the scene itself for hi-res frames.
        const frames = spec.frames ?? 120;
        const r = await runSpec(session, spec, { file: relative(process.cwd(), e.file), out: dirName, shots: [], sheet: spec.sheet ?? Math.max(1, Math.ceil(frames / 16)) });
        const fmt = (n: number) => Number.isInteger(n) ? String(n) : n.toFixed(1);
        rows.push({ name: e.name, file: relative(process.cwd(), e.file), pass: r.pass, seconds: r.seconds, frames: r.frames, errors: r.consoleErrors.length, gates: r.checks.map(c => `${c.pass ? 'ok' : 'FAIL'} ${c.name} ${fmt(c.value)}/${c.limit}`).join('; '), failed: r.failed.map(c => `${c.name} ${fmt(c.value)} > ${c.limit}`), sheet: r.sheet && relative(out, r.sheet), sheetKb: r.sheetKb, note: (spec as { note?: string }).note });
      } catch (error) {
        rows.push({ name: e.name, file: relative(process.cwd(), e.file), pass: false, seconds: (Date.now() - t0) / 1000, frames: 0, errors: session.errors.length, gates: '', failed: [], error: String(error).split('\n').slice(0, 3).join(' '), });
      }
      const last = rows[rows.length - 1];
      console.error(`[catalog] ${rows.length}/${entries.length} ${last.pass ? 'pass' : 'FAIL'} ${e.name} (${last.seconds.toFixed(1)} s)${last.failed.length ? ' ' + last.failed.join(', ') : ''}${last.error ? ' ' + last.error : ''}`);
    }
  }));
  await Promise.all(sessions.splice(0).map(s => s.close()));
  }
} catch (error) {
  console.error(error);
  for (const e of entries.filter(e => !rows.some(r => r.name === e.name))) rows.push({ name: e.name, file: relative(process.cwd(), e.file), pass: false, seconds: 0, frames: 0, errors: 0, gates: '', failed: [], error: 'not run: ' + String(error).split('\n')[0] });
} finally { await Promise.all(sessions.map(s => s.close())); stopServer(); }

rows.sort((a, b) => a.name.localeCompare(b.name));
const total = (Date.now() - started) / 1000, failedRows = rows.filter(r => !r.pass);
mkdirSync(out, { recursive: true });
const md = [
  '# Scene catalog',
  '',
  `${rows.length - failedRows.length}/${rows.length} scenes pass; ${Math.floor(total / 60)} min ${Math.round(total % 60)} s wall time (${jobs} browser(s), ${backend}, ${tiers.join('+')}${matrix ? ', zoom matrix' : ''}, ${width}x${height}). Filter: \`${flag('filter') ?? '*'}\`.`,
  `Open each \`sheet.jpg\` (labelled frames, game camera) and look at it: gates catch numbers, the sheet shows what is visibly wrong.`,
  '',
  '| Scene | Result | Sheet | Frames | s | Gates |',
  '| --- | --- | --- | --- | --- | --- |',
  ...rows.map(r => `| ${r.name} | ${r.pass ? 'pass' : '**FAIL**'} | ${r.sheet ? `[sheet](${r.sheet}) ${r.sheetKb} KB` : '-'} | ${r.frames} | ${r.seconds.toFixed(0)} | ${r.error ? `ERROR ${r.error.replace(/\|/g, '/')}` : r.gates.replace(/\|/g, '/')} |`),
  '',
  ...(failedRows.length ? ['## Failures', '', ...failedRows.map(r => `- **${r.name}** (${r.file}): ${r.error ?? r.failed.join(', ')}`), ''] : []),
].join('\n');
writeFileSync(`${out}/index.md`, md);
writeFileSync(`${out}/index.json`, JSON.stringify({ seconds: total, rows }, null, 2));
console.log(`${rows.length - failedRows.length}/${rows.length} pass in ${total.toFixed(0)} s -> ${relative(process.cwd(), out)}/index.md`);
for (const r of failedRows) console.log(`FAIL ${r.name}: ${r.error ?? r.failed.join(', ')}`);
process.exit(failedRows.length ? 1 : 0);
