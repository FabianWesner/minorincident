import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import type { Page } from '@playwright/test';
import { open, origin } from '../skinpilot/browser';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

/** Shared lifecycle of the player-animation capture scripts: L1 game page setup, the 60 Hz stepped capture loop and the WebM encoder. */
export const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
const polar = .3 * Math.PI, radius = 8;
export function encodeWebm(frames: Buffer[], file: string, o: { fps?: number; bitrate: string; crf: number }): void {
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', String(o.fps ?? 20), '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', o.bitrate, '-crf', String(o.crf), file], { input: Buffer.concat(frames), maxBuffer: 1 << 30 });
}

/** Opens the real L1 renderer (WebGL, high quality, seed 1), starts the mission, pauses the sim and puts the courier at `at`.
 * `variant` selects the survivor and frames the review camera on it; without it the follow camera is kept. */
export async function openL1(skin: string, at: { x: number; z: number }, variant?: 'female' | 'male', loadout?: [string[], string[]]) {
  const { page, close } = await open(); const guard = attachErrorGuard(page);
  await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1&skin=${skin}`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async ({ variant, at, loadout, polar, radius }) => {
    const a = window.__SS__!; await a.ready; await a.loadLevel('L1', { seed: 1 });
    document.querySelector<HTMLButtonElement>('[data-testid=mission-button]')?.click();
    a.pause(); a.cheats.god(true); if (variant) a.survivor.select(variant); a.settings.set({ cameraShake: false });
    a.survivor.present({ carrying: '' }); a.teleport('player', at);
    if (loadout) a.setLoadout(loadout[0], loadout[1]);
    if (variant) { const p = a.getState().player!.transform; a.camera.cinematic({ target: [p.x, .7, p.z], position: [p.x + radius * Math.sin(polar) / Math.SQRT2, .7 + radius * Math.cos(polar), p.z + radius * Math.sin(polar) / Math.SQRT2] }); }
  }, { variant, at, loadout, polar, radius });
  return { page, guard, close };
}

/** Hides dialogue overlays (evidence view only), zooms to the close end the wheel allows and settles `warm` rendered ticks. */
export async function prepareView(page: Page, warm: number): Promise<void> {
  await page.addStyleTag({ content: '.story-bubble,.mission-subtitle{visibility:hidden!important}' });
  await page.mouse.move(800, 450); await page.mouse.wheel(0, -3000);
  await page.evaluate(async warm => { const a = window.__SS__!; for (let i = 0; i < warm; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } await a.screenshotReady(); }, warm);
}

/** Mounts the nearest bicycle (the sim must be paused); throws when the mount fails. */
export async function mountBike(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const a = window.__SS__!, b = a.query({ kind: 'bicycle' })[0]; a.input.clear(); a.cheats.killAll();
    a.teleport('player', { x: b.transform.x + .9, z: b.transform.z });
    for (let i = 0; i < 2; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
    a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false });
    if (!a.getState().player!.riding) throw new Error(`Mount failed: ${JSON.stringify({ player: a.getState().player, bike: a.query({ kind: 'bicycle' })[0] })}`);
  });
}

/** The courier's screen position as an 800x600 (or `w`x`h`) clip inside the 1600x900 viewport. */
export const clipAround = (point: { x: number; y: number }, w = 800, h = 600, dy = 390) =>
  ({ x: Math.round(Math.min(1600 - w, Math.max(0, point.x - w / 2))), y: Math.round(Math.min(900 - h, Math.max(0, point.y - dy))), width: w, height: h });

/** The 60 Hz stepped capture loop: `scene` steps the sim, keeps the review camera on the courier and records every 3rd tick (20 fps). */
export function createRecorder(page: Page, o: { stillPath(label: string, tick: number): string; webmPath(name: string): string; log(label: string, ticks: number): void; sampleCamera?: boolean }) {
  const frames: Buffer[] = [], samples: unknown[] = [];
  const move = async (x = 0, z = 0, walk = false) => page.evaluate(v => window.__SS__!.input.set({ move: { x: v.x, z: v.z }, walk: v.walk }), { x, z, walk });
  const scene = async (label: string, ticks: number, fastClicks = false, stills = [0, 12, 30, 60]): Promise<void> => {
    for (let tick = 0; tick < ticks; tick++) {
      if (fastClicks && tick % 6 === 0) {
        // Real released Shift+LMB clicks, 10 Hz: exercise the gameplay queue.
        const p = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.input.project({ x: p.x + 1, z: p.z }); });
        await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
      }
      const s = await page.evaluate(async ({ polar, radius, withCamera }) => {
        const a = window.__SS__!, p = a.getState().player!.transform;
        a.camera.cinematic({ target: [p.x, .7, p.z], position: [p.x + radius * Math.sin(polar) / Math.SQRT2, .7 + radius * Math.cos(polar), p.z + radius * Math.sin(polar) / Math.SQRT2] });
        a.vfx.stepRender(1 / 60); await a.step(1);
        const s = a.getState(); return { tick: s.tick, character: s.render.character, player: s.player, point: a.input.project(s.player!.transform), ...(withCamera ? { camera: s.render.camera } : {}) };
      }, { polar, radius, withCamera: !!o.sampleCamera });
      if (tick % 3 === 0) {
        samples.push({ label, ...s });
        const clip = clipAround(s.point);
        frames.push(await page.screenshot({ type: 'jpeg', quality: 85, clip }));
        if (stills.includes(tick)) await page.screenshot({ path: o.stillPath(label, tick), clip });
      }
    }
    o.log(label, ticks);
  };
  const encode = (name: string) => { encodeWebm(frames, o.webmPath(name), { bitrate: '850k', crf: 18 }); frames.length = 0; };
  return { frames, samples, move, scene, encode };
}
