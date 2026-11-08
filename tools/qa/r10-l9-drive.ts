/** Real-input L9 comparison, using the existing playtest driver and progressed save.
 * sh tools/e2e-lock.sh node --import tsx tools/qa/r10-l9-drive.ts before low 1
 * Use quiet-run instead of e2e-lock for exclusive frame timing. */
import { createServer } from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { preset } from '../../src/sim/progression/Campaign';
import { SAVE_KEY } from '../../src/sim/progression/Save';
import { runSession } from '../playtest/session';

const [variant, tier, zoom, route, backend = 'webgl2'] = process.argv.slice(2);
if (!variant || !['low', 'high'].includes(tier) || !['1', '1.5'].includes(zoom)) throw Error('variant low|high 1|1.5 [road|countryside|dry-shortcut] [webgl2|webgpu]');
const tag = `${variant}-${tier}-z${zoom}${route ? `-${route}` : ''}`;
const out = resolve(`test-results/r10-l9/${tag}`), profile = `${out}/profile`;
mkdirSync(profile, { recursive: true });
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const address = socket.address(); if (!address || typeof address === 'string') throw Error('port');
const port = address.port; await new Promise<void>(done => socket.close(() => done()));
const origin = `http://127.0.0.1:${port}`, save = preset('L9-default');
save.settings.quality = tier as 'low' | 'high';
writeFileSync(`${profile}/pool-storage.json`, JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] }));
writeFileSync(`${out}/source.json`, JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), variant, tier, zoom, route: route ?? 'objective bearing', backend, input: 'real keyboard/mouse', godMode: true }, null, 2));
const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* startup */ } await new Promise(done => setTimeout(done, 100)); }
  Object.assign(process.env, { PLAYTEST_BACKEND: backend, PLAYTEST_GOD: '1', PLAYTEST_NO_FRAME_TIMING: '0', PLAYTEST_THREAT_AUDIT: '1', PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_SHOT_SECONDS: '10', PLAYTEST_ACCEPTANCE_CAPTURES: '0' });
  const result = await runSession({ origin, out, levels: ['L9'], quality: tier as 'low' | 'high', zoom: Number(zoom), heroine: 'female',
    entry: 'continue', profile, levelMinutes: 5, sampleSeconds: 280, stopAfterLevel: true, tag, noSkip: true,
    l9Route: route as 'road' | 'countryside' | 'dry-shortcut' | undefined });
  type Sample = { level: string; tick: number; step: string; visibleInfected: number[]; crossingContent?: { practicals: number; fires: number; landmarks: number; kills: number; patrols: number } };
  const audit = JSON.parse(readFileSync(`${out}/${tag}-threat.json`, 'utf8')) as { samples: Sample[]; fightFrames: { level: string; ms: number }[] };
  const samples = audit.samples.filter(s => s.level === 'L9' && s.step === 'approach');
  let emptySeconds = 0, noInfectedSeconds = 0, emptyStreak = 0, longestEmptySeconds = 0, encounters = 0, previousVisible = false;
  for (const [i, s] of samples.entries()) {
    const dt = i ? (s.tick - samples[i - 1].tick) / 60 : 0, visible = s.visibleInfected.length > 0;
    if (visible && !previousVisible) encounters++;
    previousVisible = visible;
    if (!visible) noInfectedSeconds += dt;
    const c = s.crossingContent, empty = !visible && !!c && !c.practicals && !c.fires && !c.landmarks;
    if (empty) { emptySeconds += dt; emptyStreak += dt; longestEmptySeconds = Math.max(longestEmptySeconds, emptyStreak); } else emptyStreak = 0;
  }
  const frames = audit.fightFrames.filter(f => f.level === 'L9').map(f => f.ms).sort((a, b) => a - b);
  const summary = { tag, finished: result.runs[0]?.finished, driveSeconds: samples.length ? (samples.at(-1)!.tick - samples[0].tick) / 60 : 0,
    kills: Math.max(0, ...samples.map(s => s.crossingContent?.kills ?? 0)), patrols: Math.max(0, ...samples.map(s => s.crossingContent?.patrols ?? 0)),
    encounters, emptySeconds, longestEmptySeconds, noInfectedSeconds, samples: samples.length,
    frameP95: frames[Math.floor(frames.length * .95)], frameMax: frames.at(-1), framesOver66: frames.filter(ms => ms > 66).length,
    issues: result.issues.map(i => ({ severity: i.severity, kind: i.kind, text: i.text })) };
  writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
  if (!summary.finished) process.exitCode = 1;
} finally { server.kill('SIGTERM'); }
