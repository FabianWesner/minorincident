/** Real-input L9 comparison, pooled via runSession -> launchProfile,
 * using the existing playtest driver and progressed save.
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
// A pair fits one exclusive reservation. Both children inherit its pool token.
if (variant === 'pair') {
  for (const [name, origin] of [['before-quiet', process.env.L9_BEFORE_ORIGIN], ['after-quiet', process.env.L9_AFTER_ORIGIN]]) {
    if (!origin) throw Error('pair requires L9_BEFORE_ORIGIN and L9_AFTER_ORIGIN');
    execFileSync(process.execPath, ['--import', 'tsx', 'tools/qa/r10-l9-drive.ts', name!, tier, zoom], {
      stdio: 'inherit', env: { ...process.env, L9_DRIVE_ORIGIN: origin },
    });
  }
  process.exit(0);
}
const sampleSeconds = Number(process.env.L9_DRIVE_SAMPLE_SECONDS ?? 280);
if (!Number.isFinite(sampleSeconds) || sampleSeconds <= 0 || sampleSeconds > 280) throw Error('L9_DRIVE_SAMPLE_SECONDS must be in (0, 280]');
const tag = `${variant}-${tier}-z${zoom}${route ? `-${route}` : ''}`;
// Keep the open objective-bearing crossing, with one physical steering bend
// around the existing bushes at (89, 1.6) and (108, 1.8). Do not move scenery.
const waypoints: [number, number][] | undefined = route ? undefined : [[-550, 0], [40, 0], [75, 10], [130, 10], [165, 0], [275, 0], [350, 0], [470, 0]];
const out = resolve(`test-results/r10-l9/${tag}`), profile = `${out}/profile`;
mkdirSync(profile, { recursive: true });
const socket = createServer(); await new Promise<void>(done => socket.listen(0, '127.0.0.1', done));
const address = socket.address(); if (!address || typeof address === 'string') throw Error('port');
const port = address.port; await new Promise<void>(done => socket.close(() => done()));
const origin = process.env.L9_DRIVE_ORIGIN ?? `http://127.0.0.1:${port}`, save = preset('L9-default');
save.settings.quality = tier as 'low' | 'high';
writeFileSync(`${profile}/pool-storage.json`, JSON.stringify({ cookies: [], origins: [{ origin, localStorage: [{ name: SAVE_KEY, value: JSON.stringify(save) }] }] }));
const server = process.env.L9_DRIVE_ORIGIN ? null : spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
try {
  for (let i = 0; i < 100; i++) { try { if ((await fetch(origin)).ok) break; } catch { /* startup */ } await new Promise(done => setTimeout(done, 100)); }
  const html = await (await fetch(origin)).text();
  writeFileSync(`${out}/source.json`, JSON.stringify({ revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), origin,
    bundle: /src="([^"]+\.js)"/.exec(html)?.[1], variant, tier, zoom, route: route ?? 'objective bearing with bush-clearance bend', waypoints, backend, input: 'real keyboard/mouse', godMode: true }, null, 2));
  Object.assign(process.env, { PLAYTEST_BACKEND: backend, PLAYTEST_GOD: '1', PLAYTEST_NO_FRAME_TIMING: '0', PLAYTEST_THREAT_AUDIT: '1', PLAYTEST_ACCEPTANCE_LEDGER: '1', PLAYTEST_SHOT_SECONDS: process.env.PLAYTEST_SHOT_SECONDS ?? '45', PLAYTEST_ACCEPTANCE_CAPTURES: '0' });
  const result = await runSession({ origin, out, levels: ['L9'], quality: tier as 'low' | 'high', zoom: Number(zoom), heroine: 'female',
    entry: 'continue', profile, levelMinutes: 5, sampleSeconds, stopAfterLevel: true, tag, noSkip: true,
    l9Route: route as 'road' | 'countryside' | 'dry-shortcut' | undefined, l9Waypoints: waypoints });
  type Sample = { level: string; tick: number; step: string; visibleInfected: number[]; crossingContent?: { practicals: number; fires: number; landmarks: number; kills: number; patrols: number; drawCalls?: number; triangles?: number; simMs?: number; heapMB?: number | null; liveCount?: number } };
  const audit = JSON.parse(readFileSync(`${out}/${tag}-threat.json`, 'utf8')) as { samples: Sample[]; fightFrames: { level: string; ms: number; simTickMs?: number }[] };
  const samples = audit.samples.filter(s => s.level === 'L9' && s.step === 'approach');
  const ledger = JSON.parse(readFileSync(`${out}/${tag}-acceptance-ledger.json`, 'utf8')) as { level: string; events: { type: string; tick: number; source?: string; sourceId?: number; downed?: number }[] }[];
  const events = ledger.find(l => l.level === 'L9')?.events.filter(e => e.tick <= (samples.at(-1)?.tick ?? 0)) ?? [];
  const ramEvents = events.filter(e => e.type === 'combat.kill' && e.sourceId !== 1);
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
  const tickCpu = audit.fightFrames.filter(f => f.level === 'L9' && f.simTickMs !== undefined).map(f => f.simTickMs!).sort((a, b) => a - b);
  const sim = samples.map(s => s.crossingContent?.simMs ?? 0).sort((a, b) => a - b);
  const summary = { tag, finished: result.runs[0]?.finished, driveSeconds: samples.length ? (samples.at(-1)!.tick - samples[0].tick) / 60 : 0,
    kills: Math.max(0, ...samples.map(s => s.crossingContent?.kills ?? 0)), patrols: Math.max(0, ...samples.map(s => s.crossingContent?.patrols ?? 0)),
    ramContacts: events.filter(e => e.type === 'vehicle.durability-hit' && e.source === 'contact').length,
    ramKnockdowns: ramEvents.filter(e => e.downed !== undefined).length, ramKills: ramEvents.filter(e => e.downed === undefined).length,
    encounters, emptySeconds, longestEmptySeconds, noInfectedSeconds, samples: samples.length,
    frameP95: frames[Math.floor(frames.length * .95)], frameMax: frames.at(-1), framesOver66: frames.filter(ms => ms > 66).length,
    peakDraws: Math.max(0, ...samples.map(s => s.crossingContent?.drawCalls ?? 0)), peakTriangles: Math.max(0, ...samples.map(s => s.crossingContent?.triangles ?? 0)),
    simP95: sim[Math.floor(sim.length * .95)], simTickP95: tickCpu[Math.floor(tickCpu.length * .95)], peakHeapMB: Math.max(0, ...samples.map(s => s.crossingContent?.heapMB ?? 0)), peakLiving: Math.max(0, ...samples.map(s => s.crossingContent?.liveCount ?? 0)),
    issues: result.issues.map(i => ({ severity: i.severity, kind: i.kind, text: i.text })) };
  writeFileSync(`${out}/summary.json`, JSON.stringify(summary, null, 2)); console.log(JSON.stringify(summary));
  if (!summary.finished) process.exitCode = 1;
} finally { server?.kill('SIGTERM'); }
