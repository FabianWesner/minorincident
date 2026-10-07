import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { open, origin } from '../skinpilot/browser';

/** Run through e2e-lock, with a Vite dev server on E2E_PORT serving preview/player-anim.html. */
const out = process.argv[2] ?? 'test-results/player-anim', after = process.argv[3] ?? 'after', only = process.argv[4];
const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
const { page, close } = await open({ width: 1280, height: 960 });
const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
type API = { frame(i: number): void; frames: number };
try {
  await page.route('**/recordings/**', route => route.fulfill({ contentType: 'application/json', body: readFileSync(resolve(out, new URL(route.request().url()).pathname.replace('/recordings/', ''))) }));
  for (const variant of ['female', 'male']) for (const scenario of ['walk', 'run', 'start-stop', 'turn90', 'turn180', 'unarmed', 'bat', 'hurt', 'bike']) {
    if (only && scenario !== only) continue;
    const stem = `${out}/${after}-${variant}-${scenario}`; mkdirSync(out, { recursive: true });
    await page.goto(`${origin}/preview/player-anim.html?variant=${variant}&scenario=${scenario}&after=${after}`);
    await page.waitForFunction(() => !!(window as unknown as { __PLAYER_ANIM__?: API }).__PLAYER_ANIM__);
    const count = await page.evaluate(() => (window as unknown as { __PLAYER_ANIM__: API }).__PLAYER_ANIM__.frames);
    const frames: Buffer[] = [];
    for (let i = 0; i < count; i += 4) {
      await page.evaluate(i => (window as unknown as { __PLAYER_ANIM__: API }).__PLAYER_ANIM__.frame(i), i);
      frames.push(await page.screenshot({ type: 'jpeg', quality: 90 }));
      if ([60, 120, 180, 240].includes(i)) await page.screenshot({ path: `${stem}-${i}.png` });
    }
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '15', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '3M', '-crf', '10', `${stem}.webm`], { input: Buffer.concat(frames), maxBuffer: 1024 * 1024 });
    console.log(stem, count / 60, 'seconds');
  }
  writeFileSync(`${out}/${after}-capture.json`, JSON.stringify({ errors, renderer: 'headless Chromium ANGLE Metal / WebGL2, neutral studio lighting, production recorded poses', fps: 15, camera: 'side + game angle; all frames, fixed 60/120/180/240-tick stills' }, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
} catch (error) { console.log(error); throw error; } finally { await close(); }
