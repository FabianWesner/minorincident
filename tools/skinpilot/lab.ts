import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { open, origin } from './browser';

/** Motion-lab A/B: rigid vs skinned courier, same scripted idle→walk→run→turn→stop input (720 ticks).
 * Writes metrics JSON and (unless --no-video) a side-by-side MP4/GIF from 30 fps frames. */
const out = process.argv[2] ?? 'test-results/skinpilot';
const video = !process.argv.includes('--no-video');
const query = process.argv.find(a => a.startsWith('--query='))?.slice(8) ?? '';
mkdirSync(out, { recursive: true });
const frames = `${out}/frames`; rmSync(frames, { recursive: true, force: true }); mkdirSync(frames, { recursive: true });
const { page, close } = await open({ width: 1280, height: 720 });
type Lab = { step(n: number): unknown; metrics(): unknown };
try {
  await page.goto(`${origin}/?motionlab&renderer=webgl&view=close&count=50&candidate=courier&paused=1&focus=hero${query}`);
  await page.waitForFunction(() => Boolean((window as unknown as { __MOTIONLAB__?: Lab }).__MOTIONLAB__), null, { timeout: 120_000 });
  await page.addStyleTag({ content: '#lab-ui{inset:8px 8px auto !important;padding:6px !important} #lab-ui > div:first-of-type, #lab-status{display:none}' });
  for (let tick = 0, frame = 0; tick < 720; tick += 2, frame++) {
    await page.evaluate(() => (window as unknown as { __MOTIONLAB__: Lab }).__MOTIONLAB__.step(2));
    if (video) await page.screenshot({ path: `${frames}/${String(frame).padStart(4, '0')}.png` });
  }
  const metrics = await page.evaluate(() => (window as unknown as { __MOTIONLAB__: Lab }).__MOTIONLAB__.metrics());
  writeFileSync(`${out}/lab-metrics.json`, JSON.stringify(metrics, null, 2));
  writeFileSync(`${out}/lab-tracks.json`, JSON.stringify(await page.evaluate(() => (window as unknown as { __MOTIONLAB__: { tracks(): unknown } }).__MOTIONLAB__.tracks())));
  console.log(JSON.stringify(metrics));
} finally { await close(); }
if (video) {
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${frames}/%04d.png`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', `${out}/lab-rigid-vs-skinned.mp4`]);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${out}/lab-rigid-vs-skinned.mp4`, '-vf', 'fps=20,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer', `${out}/lab-rigid-vs-skinned.gif`]);
}
