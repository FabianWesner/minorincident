/** vqa60 (copy of vqa59-run.ts) (pooled via runSession -> launchProfile) vqa59 (copy of vqa58-run.ts, copy of vqa-4-run.ts): real-input visual re-check (adds replay = L8-default progressed save + level select) through the shared browser pool (one context per run).
 *   node --import tsx tools/qa/vqa-4-run.ts <level> <low|high> <webgl2|webgpu> <zoom> <tracked|preset|fresh|keep> <label> [seconds] [weapon] [heroine]
 * tracked: versioned L10 corridor checkpoint; VQA_TRACKED_SAVE optionally overrides it (JSON or .gz).
 * preset: L<n>-default progressed save. fresh: empty profile, level select (?debug=1). keep: resume the label's profile.
 * Output under test-results/vqa60/<label>; captures every PLAYTEST_SHOT_SECONDS (default 5) plus per-step low/high x zoom 1.5/0.5. */
import { gunzipSync } from 'node:zlib';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { preset, type ProgressionPreset } from '../../src/sim/progression/Campaign';
import { decodeSave, SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession } from '../playtest/session';
import { provenance } from './accept/probe';

const [level, tier, backend, zoom, source, label, seconds = '420', weapon, heroine = 'female'] = process.argv.slice(2);
const out = resolve(`test-results/vqa60/${label}`), profile = join(out, 'profile');
mkdirSync(profile, { recursive: true });
writeFileSync(join(out, 'source.json'), JSON.stringify({ ...provenance(), input: {
  level, tier, backend, zoom: Number(zoom), source, courierGodMode: (process.env.PLAYTEST_GOD ?? '1') === '1',
  movingCoverRoute: process.env.PLAYTEST_L7_ESCORT_ROUTE === '1', noSkip: true, frameTiming: false,
} }, null, 2));
let trackedSave: ReturnType<typeof preset> | undefined;
if (source === 'tracked') {
  if (level !== 'L10') throw new Error('tracked source is an L10 checkpoint');
  const trackedPath = process.env.VQA_TRACKED_SAVE ?? `docs/reports/sweep-c5/L10-05/seeds/L10-05-${tier}-cure-corridor-save.json.gz`;
  // Slim worktrees omit binary report receipts. Read the versioned seed from
  // the current tree without relying on a historical commit ID or checkout.
  const bytes = process.env.VQA_TRACKED_SAVE || existsSync(resolve(trackedPath))
    ? readFileSync(resolve(trackedPath)) : execFileSync('git', ['show', `HEAD:${trackedPath}`]);
  const decoded = decodeSave(trackedPath.endsWith('.gz') ? gunzipSync(bytes).toString() : bytes.toString());
  if (decoded.status !== 'ok') throw new Error('tracked source is not a valid campaign save');
  trackedSave = decoded.save;
  if (trackedSave?.unlockedLevel !== 10 || !trackedSave.cureResume) throw new Error('tracked source must contain an exported L10 checkpoint');
  writeFileSync(join(out, 'tracked-source.json'), JSON.stringify({ path: trackedPath, sha256: createHash('sha256').update(bytes).digest('hex') }, null, 2));
}
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const address = socket.address(); if (!address || typeof address === 'string' || address.port === 3300) throw new Error('port');
const port = address.port; await new Promise<void>(done => socket.close(() => done()));
const origin = process.env.VQA_ORIGIN ?? `http://127.0.0.1:${port}`; // vqa59: VQA_ORIGIN runs against a deployed build (QA env = batch 57)
if (source === 'tracked' || source === 'preset' || source === 'replay') {
  const save = source === 'tracked' ? trackedSave! : preset((source === 'replay' ? 'L8-default' : `${level}-default`) as ProgressionPreset);
  save.settings.quality = tier as 'low' | 'high'; if (source !== 'tracked') save.character = heroine as 'female' | 'male';
  writeFileSync(join(profile, 'pool-storage.json'), JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] }));
}
if (source === 'keep') { // vqa-4: the preview port changes per run, so move the saved local storage to the new origin.
  const file = join(profile, 'pool-storage.json');
  if (existsSync(file)) { const s = JSON.parse(readFileSync(file, 'utf8')); for (const o of s.origins ?? []) if (o.origin.startsWith('http://127.0.0.1:')) o.origin = origin; writeFileSync(file, JSON.stringify(s)); }
}
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
let code = 0;
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* startup */ } await new Promise(done => setTimeout(done, 100)); }
  Object.assign(process.env, { PLAYTEST_BACKEND: backend, PLAYTEST_GOD: process.env.PLAYTEST_GOD ?? '1', PLAYTEST_NO_FRAME_TIMING: '1', PLAYTEST_FRAME_GATE: '0', PLAYTEST_CPU_PROFILE: '0', PLAYTEST_ACCEPTANCE_CAPTURES: process.env.PLAYTEST_ACCEPTANCE_CAPTURES ?? '1', PLAYTEST_SHOT_SECONDS: process.env.PLAYTEST_SHOT_SECONDS ?? '5' });
  const result = await runSession({ origin, out, levels: [level], quality: tier as 'low' | 'high', zoom: Number(zoom), heroine: heroine as 'female' | 'male', weapon,
    entry: source === 'fresh' || source === 'replay' ? 'debug' : 'continue', profile, levelMinutes: Number(process.env.VQA_LEVEL_MINUTES ?? 9), sampleSeconds: Number(seconds), stopAfterLevel: true, tag: label, noSkip: true,
    saveOnYield: level === 'L10' ? true : undefined } as Parameters<typeof runSession>[0]);
  console.log(JSON.stringify(result.runs.map(r => ({ level: r.level, finished: r.finished, deaths: r.deaths, sim: r.simSeconds }))));
} catch (error) { console.error(error); code = 1; } finally { server.kill('SIGTERM'); }
process.exit(code);
