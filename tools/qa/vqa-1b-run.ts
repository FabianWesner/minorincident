/** vqa-1b: real-input visual re-check of L7-L10 through the shared browser pool (one context per run).
 *   node --import tsx tools/qa/vqa-1b-run.ts <level> <low|high> <webgl2|webgpu> <zoom> <tracked|preset|fresh|keep> <label> [seconds] [weapon] [heroine]
 * tracked: L10 only, the fix51-r10c physical save just before the dispersal complex (Mega already in pursuit).
 * preset: L<n>-default progressed save. fresh: empty profile, level select (?debug=1). keep: resume the label's profile.
 * Output under test-results/vqa-1b/<label>; captures every PLAYTEST_SHOT_SECONDS (default 5) plus per-step low/high x zoom 1.5/0.5. */
import { execFileSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession } from '../playtest/session';

const [level, tier, backend, zoom, source, label, seconds = '420', weapon, heroine = 'female'] = process.argv.slice(2);
const out = resolve(`test-results/vqa-1b/${label}`), profile = join(out, 'profile');
mkdirSync(profile, { recursive: true });
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const address = socket.address(); if (!address || typeof address === 'string' || address.port === 3300) throw new Error('port');
const port = address.port; await new Promise<void>(done => socket.close(() => done()));
const origin = `http://127.0.0.1:${port}`;
if (source === 'tracked' || source === 'preset') {
  const save = source === 'tracked'
    ? JSON.parse(gunzipSync(execFileSync('git', ['show', `40f3d1de9:docs/reports/fix51-r10c/L10-${tier}-second-resume.json.gz`])).toString())
    : preset(`${level}-default` as ProgressionPreset);
  save.settings.quality = tier; if (source === 'preset') save.character = heroine;
  writeFileSync(join(profile, 'pool-storage.json'), JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] }));
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let code = 0;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* startup */ } await new Promise(done => setTimeout(done, 100)); }
  Object.assign(process.env, { PLAYTEST_BACKEND: backend, PLAYTEST_GOD: process.env.PLAYTEST_GOD ?? '1', PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0', PLAYTEST_ACCEPTANCE_CAPTURES: process.env.PLAYTEST_ACCEPTANCE_CAPTURES ?? '1', PLAYTEST_SHOT_SECONDS: process.env.PLAYTEST_SHOT_SECONDS ?? '5' });
  const result = await runSession({ origin, out, levels: [level], quality: tier as 'low' | 'high', zoom: Number(zoom), heroine: heroine as 'female' | 'male', weapon,
    entry: source === 'fresh' ? 'debug' : 'continue', profile, levelMinutes: 9, sampleSeconds: Number(seconds), stopAfterLevel: true, tag: label, noSkip: true,
    saveOnYield: level === 'L10' ? true : undefined } as Parameters<typeof runSession>[0]);
  console.log(JSON.stringify(result.runs.map(r => ({ level: r.level, finished: r.finished, deaths: r.deaths, sim: r.simSeconds }))));
} catch (error) { console.error(error); code = 1; } finally { server.kill('SIGTERM'); }
process.exit(code);
