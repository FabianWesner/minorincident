import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { open, origin } from './browser';

/** L1 at the game camera: rigid (skin=0) vs skinned (skin=1) courier, same scripted input, then a
 * crowd perf probe (60 infected around the courier + corgi), desktop and Pixel-7-like emulation.
 * Usage: npx tsx tools/skinpilot/l1-ab.ts <outDir> [--no-video] [--perf-only] */
const out = process.argv[2] ?? 'test-results/skinpilot';
const video = !process.argv.includes('--no-video') && !process.argv.includes('--perf-only');
mkdirSync(out, { recursive: true });
type Step = { ticks: number; move?: { x: number; z: number }; walk?: boolean; act?: string };
const script: Step[] = [
  // Open sidewalk/road lane east of the depot (probed): walk, stop, run with two 180° turns, stop, jab.
  { ticks: 40 }, { ticks: 100, move: { x: 0, z: 1 }, walk: true }, { ticks: 30 }, { ticks: 110, move: { x: 0, z: -1 } },
  { ticks: 60, move: { x: 0, z: 1 } }, { ticks: 40 }, { ticks: 36, act: 'swing' }, { ticks: 50 },
];
const perf: Record<string, unknown> = {};
for (const profile of ['desktop', 'mobile'] as const) {
  const mobile = profile === 'mobile';
  if (mobile && video) { /* video only on desktop */ }
  for (const skin of ['0', '1']) {
    const frames = `${out}/frames-${skin}`;
    const capture = video && !mobile;
    if (capture) { rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true }); }
    const { page, close } = await open(mobile ? { width: 412, height: 915 } : { width: 1600, height: 900 }, mobile);
    try {
      if (mobile) { const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
      await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=${mobile ? 'low' : 'high'}&audio=muted&seed=1&skin=${skin}`);
      await page.waitForFunction(() => Boolean(window.__SS__), null, { timeout: 180_000 });
      await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L1'); });
      const begin = page.getByRole('button', { name: 'Begin mission' });
      if (await begin.isVisible().catch(() => false)) await begin.click();
      await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.cheats.god(true); await a.step(2); const p = a.getState().player!.transform; a.teleport('player', { x: p.x + 4, z: p.z }); await a.step(2); });
      if (capture) {
        let frame = 0;
        for (const step of script) {
          await page.evaluate(s => { const a = window.__SS__!; a.input.set({ move: s.move ?? { x: 0, z: 0 }, walk: !!s.walk }); if (s.act) a.survivor.act(s.act as never); }, step);
          for (let t = 0; t < step.ticks; t += 2) {
            await page.evaluate(() => window.__SS__!.step(2));
            const p = await page.evaluate(() => { const a = window.__SS__!, t = a.getState().player!.transform; return a.input.project({ x: t.x, z: t.z }); });
            const x = Math.round(Math.min(1600 - 360, Math.max(0, p.x - 180))), y = Math.round(Math.min(900 - 360, Math.max(0, p.y - 230)));
            await page.screenshot({ path: `${frames}/${String(frame++).padStart(4, '0')}.png`, clip: { x, y, width: 360, height: 360 } });
          }
        }
        await page.evaluate(() => window.__SS__!.input.clear());
      }
      // Crowd perf: 60 idle infected in a ring around the courier (corgi and town as loaded).
      await page.evaluate(async () => {
        const a = window.__SS__!, p = a.getState().player!.transform;
        let placed = 0;
        for (let i = 0; i < 400 && placed < 60; i++) { const r = 2.5 + (i % 7) * 1.1, ang = i * 2.399963; try { a.spawn('infected.runner', { x: p.x + Math.cos(ang) * r, z: p.z + Math.sin(ang) * r }, { state: 'idle' }); placed++; } catch { /* collider/grid: try next */ } }
        await a.step(2);
      });
      await page.evaluate(() => { const a = window.__SS__!; a.input.set({ move: { x: 0, z: 0 } }); a.resume(); });
      await page.waitForTimeout(2500);
      const samples: number[] = [];
      for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); samples.push((await page.evaluate(() => window.__SS__!.perf().frameMs)) as number); }
      const snap = await page.evaluate(() => { const p = window.__SS__!.perf(); return { drawCalls: p.drawCalls, triangles: p.triangles, simMs: p.simMs, backend: p.backend, quality: p.quality, entities: p.entities, character: window.__SS__!.getState().render.character }; });
      samples.sort((a, b) => a - b);
      perf[`${profile}-skin${skin}`] = { ...snap, frameMsP50: samples[10], frameMsP95: samples[18] };
      if (!mobile) await page.screenshot({ path: `${out}/crowd-skin${skin}.png` });
      console.log(profile, skin, JSON.stringify(perf[`${profile}-skin${skin}`]).slice(0, 400));
    } finally { await close(); }
  }
}
writeFileSync(`${out}/l1-perf.json`, JSON.stringify(perf, null, 2));
if (video) {
  // This ffmpeg build has no drawtext: label the frames with PIL.
  execFileSync('python3', ['-c', `import sys,glob\nfrom PIL import Image,ImageDraw\nfor d,t in (('${out}/frames-0','Rigid courier (current)'),('${out}/frames-1','Skinned courier (?skin=1)')):\n  for f in glob.glob(d+'/*.png'):\n    im=Image.open(f).convert('RGB');g=ImageDraw.Draw(im);g.rectangle((0,0,250,28),fill=(23,33,55));g.text((8,8),t,fill=(255,255,255));im.save(f)`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${out}/frames-0/%04d.png`, '-framerate', '30', '-i', `${out}/frames-1/%04d.png`,
    '-filter_complex', '[0:v][1:v]hstack=inputs=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', `${out}/l1-game-camera-rigid-vs-skinned.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${out}/l1-game-camera-rigid-vs-skinned.mp4`, '-vf', 'fps=15,scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer', `${out}/l1-game-camera-rigid-vs-skinned.gif`]);
}
