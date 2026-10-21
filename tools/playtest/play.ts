import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Issue, LevelRun, SessionOptions } from './session';

/**
 * Playtest driver: plays the campaign by real keyboard/mouse input on the production preview build, headless.
 *
 *   npm run build && npm run playtest -- --levels L1-L10 --quality low [--mode campaign|continue] [--heroine female|male]
 *                                       [--zoom 1.5] [--level-minutes 25] [--out test-results/playtest/<name>]
 *
 * campaign: one browser session from a new game through every real handover.
 * continue: one browser session per level; each resumes the save through the menu (Start game → resume level),
 *           plays it and stops after the handover, so the browser lock is released between levels.
 * Every browser session runs under tools/e2e-lock.sh (one unit). Ports: E2E_PORT (default 3821), never 3300.
 * Output: <out>/summary.json, log-*.jsonl (assists, hitches, progress), issues-*.json and captures/.
 */
const { values } = parseArgs({ options: {
  levels: { type: 'string', default: 'L1-L10' }, quality: { type: 'string', default: 'low' }, mode: { type: 'string', default: 'campaign' },
  heroine: { type: 'string', default: 'female' }, zoom: { type: 'string', default: '1.5' }, 'level-minutes': { type: 'string', default: '25' },
  out: { type: 'string' }, entry: { type: 'string' }, 'keep-profile': { type: 'boolean', default: false },
} });
const range = (spec: string): string[] => {
  const all = Array.from({ length: 10 }, (_, i) => `L${i + 1}`);
  return spec.split(',').flatMap(part => { const [a, b] = part.split('-'); const i = all.indexOf(a), j = all.indexOf(b ?? a); if (i < 0 || j < 0) throw new Error(`Bad level range ${part}`); return all.slice(i, j + 1); });
};
const levels = range(values.levels!);
const quality = values.quality === 'high' ? 'high' : 'low';
const mode = values.mode === 'continue' ? 'continue' : 'campaign';
const out = resolve(values.out ?? `test-results/playtest/${mode}-${quality}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}`);
mkdirSync(out, { recursive: true });
const port = Number(process.env.E2E_PORT ?? 3821);
if (port === 3300) throw new Error('The playtest must not use the shared dev-server port 3300');
const origin = `http://127.0.0.1:${port}`;
if (!existsSync('dist/index.html')) throw new Error('Run npm run build first: the playtest plays the production preview build');

const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
let server: ChildProcess | null = null;
if (!(await up())) {
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  if (!(await up())) { server.kill(); throw new Error(`preview server did not start on ${port}`); }
}
const profile = join(out, 'profile');
if (!values['keep-profile']) rmSync(profile, { recursive: true, force: true });
const runs: LevelRun[] = [], issues: Issue[] = [];
const session = (options: SessionOptions): boolean => {
  // Each browser session takes one unit of the shared browser lock and releases it when it closes.
  const result = spawnSync('sh', ['tools/e2e-lock.sh', process.execPath, resolve('node_modules/tsx/dist/cli.mjs'), 'tools/playtest/session.ts', JSON.stringify(options)], { stdio: 'inherit', env: { ...process.env, E2E_UNITS: '1' } });
  for (const [file, list] of [[`runs-${options.tag}.json`, runs], [`issues-${options.tag}.json`, issues]] as const) {
    const path = join(out, file); if (existsSync(path)) (list as unknown[]).push(...JSON.parse(readFileSync(path, 'utf8')));
  }
  return result.status === 0;
};
const base = { origin, out, quality, zoom: Number(values.zoom), heroine: (values.heroine === 'male' ? 'male' : 'female') as 'female' | 'male', profile, levelMinutes: Number(values['level-minutes']) } as const;
try {
  if (mode === 'campaign') session({ ...base, levels, entry: (values.entry as SessionOptions['entry']) ?? (levels[0] === 'L1' ? 'new' : 'debug'), stopAfterLevel: false, tag: 'campaign' });
  else for (const [i, level] of levels.entries()) {
    const resumed = i > 0 && runs.some(r => r.level === levels[i - 1] && r.finished);
    const entry = i === 0 ? (level === 'L1' ? 'new' : (values.entry as SessionOptions['entry']) ?? 'continue') : resumed ? 'continue' : 'debug';
    session({ ...base, levels: [level], entry, stopAfterLevel: true, tag: `continue-${level}` });
  }
} finally { server?.kill(); }
const summary = { mode, quality, heroine: base.heroine, zoom: base.zoom, levels, runs, issues: issues.length, bySeverity: Object.fromEntries(['P0', 'P1', 'P2', 'P3'].map(s => [s, issues.filter(x => x.severity === s).length])) };
writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 2));
if (!values['keep-profile']) rmSync(profile, { recursive: true, force: true });
console.log(`playtest ${mode}: ${runs.filter(r => r.finished).length}/${levels.length} levels finished; issues ${JSON.stringify(summary.bySeverity)} → ${out}`);
process.exit(runs.filter(r => r.finished && !r.skipped.length).length === levels.length ? 0 : 1);
