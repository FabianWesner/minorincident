import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { open, origin } from './browser';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

/** Identical, paused 60 Hz L1 inputs, sampled at 15 fps. Both videos are 14.47 s.
 * Run after build through tools/e2e-lock.sh. Frames are retired after encoding.
 * CPU includes CharacterView animation/contact work; profile.ts separately
 * includes world matrices and Skeleton.update without any simulation work. */
const out = process.argv[2] ?? 'test-results/skin-pilot';
const capture = !process.argv.includes('--perf-only');
const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
if (capture && !existsSync(ffmpeg)) throw new Error('Set FFMPEG_BIN to a local FFmpeg with libvpx');
mkdirSync(out, { recursive: true });
const results: Record<string, unknown> = {};
for (const skin of ['0', '1']) {
  const frames = `${out}/frames-${skin}`; if (capture) mkdirSync(frames, { recursive: true });
  const { page, close } = await open(); const guard = attachErrorGuard(page);
  let frame = 0;
  const samples: Record<string, { cpuMs: number; drawCalls: number; clip: string | undefined }[]> = {};
  try {
    await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1&skin=${skin}`);
    await page.waitForFunction(() => Boolean(window.__SS__), null, { timeout: 120_000 });
    await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L1'); });
    const begin = page.getByRole('button', { name: 'Begin mission' }); if (await begin.isVisible().catch(() => false)) await begin.click();
    await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); a.input.clear(); a.teleport('player', { x: -62, z: 0 }); await a.step(2); });
    const scene = async (label: string, ticks: number): Promise<void> => {
      samples[label] ??= [];
      for (let t = 0; t < ticks; t += 4) {
        const data = await page.evaluate(async () => {
          const a = window.__SS__!; await a.step(4);
          const s = a.getState(), c = s.render.character!;
          return { cpuMs: c.cpuMs, drawCalls: a.perf().drawCalls, clip: c.clip, point: a.input.project(s.player!.transform) };
        });
        samples[label].push(data);
        if (capture) {
          const x = Math.round(Math.min(1600 - 640, Math.max(0, data.point.x - 320))), y = Math.round(Math.min(900 - 480, Math.max(0, data.point.y - 270)));
          const path = `${frames}/${String(frame++).padStart(4, '0')}.png`;
          await page.screenshot({ path, clip: { x, y, width: 640, height: 480 } });
          if (t === Math.floor(ticks / 8) * 4) await page.screenshot({ path: `${out}/skin${skin}-${label}.png` });
        }
      }
      console.log('captured', skin, label, ticks);
    };
    const move = async (x = 0, z = 0, walk = false) => page.evaluate(v => window.__SS__!.input.set({ move: { x: v.x, z: v.z }, walk: v.walk }), { x, z, walk });
    const strike = async (weapon: string) => page.evaluate(async id => {
      const a = window.__SS__!, p = a.getState().player!.transform; a.input.clear(); a.setLoadout([id], ['weapon.fists']);
      a.spawn('infected.runner', { x: p.x + 1.2, z: p.z }, { state: 'idle' });
      a.input.set({ left: { down: true, held: true, up: false }, aim: { x: 1, z: 0 }, attackInPlace: true }); await a.step(1);
      a.input.set({ left: { down: false, held: false, up: true } });
    }, weapon);
    await scene('idle', 24); await move(1, 0, true); await scene('walk', 120);
    await move(1); await scene('run', 60); await move(); await scene('stop', 24);
    await strike('weapon.fists'); await scene('jab', 48);
    await strike('weapon.kick'); await scene('kick', 48);
    await strike('weapon.bat'); await scene('bat', 60);
    await page.evaluate(() => window.__SS__!.survivor.damage(1)); await scene('hurt', 36);
    // Exercise the real mount/dismount path. Parked-bike capsule clearance keeps
    // the player beside the saddle rather than inside its collision circles.
    await page.evaluate(async () => {
      const a = window.__SS__!, b = a.query({ kind: 'bicycle' })[0]; a.input.clear(); a.cheats.killAll();
      a.teleport('player', { x: -62, z: 0 }); a.teleport(b.id, { x: -60.8, z: 0 });
      a.input.set({ move: { x: 1, z: 0 }, walk: true }); await a.step(12); a.input.clear();
      a.input.set({ interact: true }); await a.step(1); a.input.set({ interact: false });
      if (!a.getState().player!.riding) throw new Error('Pilot mount failed');
    });
    await scene('mount', 48); await move(1, 0); await scene('ride', 228);
    await page.evaluate(async () => { const a = window.__SS__!; a.input.clear(); a.input.set({ interact: true }); await a.step(1); a.input.set({ interact: false }); });
    await scene('dismount', 48); await scene('rest', 24);
    const state = await page.evaluate(() => window.__SS__!.getState());
    results[`skin${skin}`] = { character: state.render.character, backend: (await page.evaluate(() => window.__SS__!.perf())).backend,
      samples, player: state.player, events: await page.evaluate(() => window.__SS__!.events().filter(e => /combat.attack|player.damage/.test(e.type))), consoleErrors: guard.errors };
    if (guard.errors.length) throw new Error(guard.errors.join('\n'));
    if (capture) execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', '15', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '2M', '-crf', '10', `${out}/skin${skin}.webm`], { input: Buffer.concat(readdirSync(frames).sort().map(f => readFileSync(`${frames}/${f}`))) });
  } finally { guard.dispose(); await close(); if (capture) rmSync(frames, { recursive: true, force: true }); }
}
writeFileSync(`${out}/ab-measurements.json`, JSON.stringify(results, null, 2) + '\n');
const pair = results as Record<string, { samples: Record<string, { cpuMs: number; drawCalls: number }[]>; player: unknown }>;
const percentile = (values: number[], p: number): number => values.sort((a, b) => a - b)[Math.floor((values.length - 1) * p)];
const summary = Object.fromEntries(['0', '1'].map(skin => [skin, Object.fromEntries(Object.entries(pair[`skin${skin}`].samples).map(([scene, samples]) => [scene, {
  cpuP50: percentile(samples.map(s => s.cpuMs), .5), cpuP95: percentile(samples.map(s => s.cpuMs), .95), draws: percentile(samples.map(s => s.drawCalls), .5),
}]))]));
writeFileSync(`${out}/ab-summary.json`, JSON.stringify({ summary, samePlayerState: JSON.stringify(pair.skin0.player) === JSON.stringify(pair.skin1.player), durationSeconds: 868 / 60 }, null, 2) + '\n');
console.log(JSON.stringify(summary));
