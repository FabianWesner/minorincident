import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { decodeLog } from '../../src/telemetry/codec';
import { gunzip } from '../../src/telemetry/gzip';
import { downloadBundle, defaultBase, type ReplayBundle } from './api';
import { encodeWebm, thumbnail } from '../scenelab/session';

/**
 * Replay a recorded play session (anonymous input log) through the real game, headless, and report what happened.
 *
 *   npm run replay -- <replay-id | bundle.json> [--video out.webm] [--shots N] [--from SEC --seconds N --fps 12]
 *                      [--save bundle.json] [--out dir] [--summary summary.json] [--base https://minor-incident.com]
 *
 * It checks out nothing: it warns when the replay's build commit differs from HEAD (a different build may simulate differently).
 * Output: summary JSON (deaths, time per objective, stalls, distance travelled, result), optional screenshots (evenly spaced plus
 * one second before each death) and a WebM of a window of play, for QA agents. Wrap in `sh tools/e2e-lock.sh` (the npm script does).
 */
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  video: { type: 'string' }, shots: { type: 'string' }, ticks: { type: 'string' }, backend: { type: 'string', default: 'webgl2' }, fps: { type: 'string', default: '12' }, from: { type: 'string', default: '0' }, seconds: { type: 'string', default: '12' },
  save: { type: 'string' }, out: { type: 'string' }, summary: { type: 'string' }, base: { type: 'string', default: defaultBase },
} });
const source = positionals[0];
if (!source) { console.error('usage: npm run replay -- <replay-id | bundle.json> [--video out.webm] [--shots N] [--from SEC --seconds N --fps 12] [--save bundle.json] [--out dir]'); process.exit(2); }

const bundle: ReplayBundle = existsSync(source) ? JSON.parse(readFileSync(source, 'utf8')) : await downloadBundle(source, values.base);
if (values.save) { writeFileSync(values.save, JSON.stringify(bundle)); console.error(`saved ${values.save}`); }
const raw = await Promise.all(bundle.chunks.map(c => gunzip(new Uint8Array(Buffer.from(c, 'base64')))));
const log = decodeLog(raw), meta = log.meta ?? {};
const warnings: string[] = [];
let head = 'unknown'; try { head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* no git */ }
if (meta.build && meta.build !== head) warnings.push(`replay was recorded on build ${meta.build}, this checkout is ${head}: the simulation may differ and the replay may drift`);
if (meta.coarse) warnings.push('recorded on a touch device (coarse pointer): NPC quality rules may differ on this desktop browser');
const [width, height] = (meta.viewport as number[] | undefined) ?? [1600, 900];
const out = resolve(values.out ?? `test-results/replay/${bundle.id.slice(0, 8)}`);
mkdirSync(out, { recursive: true });
console.error(`replay ${bundle.id}: level ${meta.level}, seed ${meta.seed}, ${log.samples} samples (${(log.samples / 3600).toFixed(1)} min), ${log.commands.length} commands, viewport ${width}x${height}, build ${meta.build}`);

// --- server and browser ---
const port = Number(process.env.REPLAY_PORT ?? 3342);
if (port === 3300) throw new Error('Replay must not use the shared dev-server port 3300');
/** REPLAY_ORIGIN: replay against a deployed build (e.g. a PROD snapshot) instead of a private server. */
const origin = process.env.REPLAY_ORIGIN ?? `http://127.0.0.1:${port}`;
let server: ChildProcess | null = null;
const up = async () => { try { return (await fetch(origin)).ok; } catch { return false; } };
if (!(await up())) {
  const preview = process.env.REPLAY_SERVER === 'preview';
  server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), ...(preview ? ['preview'] : []), '--host', '127.0.0.1', '--port', String(port), '--strictPort', '--configLoader', 'runner'], { stdio: 'ignore' });
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 500));
  if (!(await up())) { server.kill(); throw new Error(`replay server did not start on ${port}`); }
}
const args = values.backend === 'webgpu' ? ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=metal'] : process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ headless: true, args });
const files: string[] = [];
let code = 0;
try {
  const quality = meta.qualityParam === 'high' || meta.qualityParam === 'low' ? meta.qualityParam : meta.quality === 'low' ? 'low' : 'high';
  const url = `${origin}/?test=1${values.backend === 'webgpu' ? '' : '&renderer=webgl'}&dpr=1&audio=muted&quality=${quality}&seed=${meta.seed ?? 1}`;
  const errors: string[] = [];
  /** One fresh page, level loaded, ready to feed samples. */
  const open = async () => {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(url);
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
    await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
    await page.evaluate(chunks => window.__SS__!.replay.start(chunks), raw.map(c => Buffer.from(c).toString('base64')));
    return page;
  };
  const advanceTo = (page: Awaited<ReturnType<typeof open>>, sample: number, block = 8) => page.evaluate(([until, b]) => window.__SS__!.replay.advance(until, b), [sample, block] as const);

  // Pass 1: fast, no capture: the summary.
  let page = await open();
  for (let at = 0; at < log.samples; at += 3000) await advanceTo(page, Math.min(log.samples, at + 3000), 30);
  const summary = await page.evaluate(() => { const { path, ...rest } = window.__SS__!.replay.summary(); return { ...rest, pathSamples: path.length / 2 }; });
  await page.context().close();
  const biasToSample = summary.samples - summary.ticks;

  // Pass 2: screenshots and video.
  const tickShots = (values.ticks ?? '').split(',').filter(Boolean).map(Number);
  const nShots = Number(values.shots ?? 0) + tickShots.length, wantVideo = !!values.video;
  if (nShots > 0 || wantVideo) {
    page = await open();
    const targets: { sample: number; label: string }[] = [];
    for (const t of tickShots) targets.push({ sample: t + biasToSample, label: `tick${t}` });
    for (let i = 1; i <= nShots - tickShots.length; i++) targets.push({ sample: Math.round(log.samples * i / (nShots + 1)), label: `p${i}` });
    summary.deaths.slice(0, 6).forEach((d, i) => targets.push({ sample: Math.max(0, d.tick + biasToSample - 60), label: `death${i + 1}` }));
    summary.objectives.slice(0, 8).forEach(o => nShots > 0 && targets.push({ sample: o.completedTick + biasToSample, label: `done-${o.id}` }));
    targets.sort((a, b) => a.sample - b.sample);
    const frames: Buffer[] = [];
    const videoFrom = Math.round(Number(values.from) * 60), videoTo = Math.min(log.samples, videoFrom + Math.round(Number(values.seconds) * 60)), every = Math.max(1, Math.round(60 / Number(values.fps)));
    const pending = targets.slice();
    const shot = async (label: string) => {
      await page.evaluate(() => window.__SS__!.screenshotReady());
      const tick = await page.evaluate(() => window.__SS__!.tick());
      let png = await page.screenshot({ type: 'png' });
      if (width > 1600) png = thumbnail(png, 1600);
      const file = `${out}/shot-t${String(tick).padStart(5, '0')}-${label}.png`; writeFileSync(file, png); files.push(file);
      // QA: the entities around the courier in this frame (model, LOD, accessory) to name what a capture shows.
      const near = await page.evaluate(() => { const p = window.__SS__!.getEntity(1)?.transform; return !p ? [] : window.__SS__!.query({ within: { x: p.x, z: p.z, r: 8 } }).filter(e => e.id !== 1).map(e => ({ id: e.id, archetype: e.archetype, x: e.transform.x, z: e.transform.z, civilian: e.civilian, appearance: e.appearance, infected: e.infected })); }).catch(() => []);
      writeFileSync(file.replace(/\.png$/, '.figures.json'), JSON.stringify(near, null, 1));
    };
    let cursor = 0;
    while (cursor < log.samples && (pending.length || (wantVideo && cursor < videoTo))) {
      const inVideo = wantVideo && cursor >= videoFrom && cursor < videoTo;
      const nextShot = pending[0]?.sample ?? Infinity;
      const next = inVideo ? Math.min(cursor + every, nextShot, videoTo) : Math.min(wantVideo && cursor < videoFrom ? videoFrom : Infinity, nextShot, log.samples);
      await advanceTo(page, Math.max(next, cursor + 1), inVideo ? every : 30);
      cursor = Math.max(next, cursor + 1);
      if (inVideo) { await page.evaluate(() => window.__SS__!.screenshotReady()); frames.push(await page.screenshot({ type: 'jpeg', quality: 70 })); }
      while (pending.length && pending[0].sample <= cursor) await shot(pending.shift()!.label);
    }
    if (wantVideo && frames.length) { encodeWebm(frames, resolve(values.video!), Number(values.fps)); files.push(resolve(values.video!)); }
    await page.context().close();
  }
  if (errors.length) warnings.push(`browser errors during replay: ${[...new Set(errors)].slice(0, 5).join(' | ')}`);
  const report = { replay: bundle.id, meta: { level: meta.level, seed: meta.seed, build: meta.build, viewport: meta.viewport, quality: meta.quality, samples: log.samples, minutes: Math.round(log.samples / 360) / 10 }, warnings, files, ...summary };
  const summaryPath = resolve(values.summary ?? `${out}/summary.json`);
  writeFileSync(summaryPath, JSON.stringify(report, null, 2)); console.error(`summary ${summaryPath}`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) { console.error(error); code = 1; }
finally { await browser.close(); server?.kill(); }
process.exit(code);
