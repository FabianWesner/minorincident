import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { open, origin } from '../skinpilot/browser';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

/** Actual L1 renderer/camera, game angle/FOV at a close review radius, every sim pose evaluated at
 * 60 Hz and captured at 20 fps. Run through e2e-lock, on a dedicated Vite port. */
const out = process.argv[2] ?? 'test-results/player-anim-r1';
const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
const bikeOnly = process.argv.includes('--bike-only');
for (const variant of ['female', 'male'] as const) {
  if (process.argv.includes('--female') && variant !== 'female') continue;
  const { page, close } = await open(); const guard = attachErrorGuard(page);
  try {
    await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1&skin=1`);
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
    await page.evaluate(async variant => {
      const a = window.__SS__!; await a.ready; await a.loadLevel('L1', { seed: 1 });
      document.querySelector<HTMLButtonElement>('[data-testid=mission-button]')?.click();
      a.pause(); a.cheats.god(true); a.survivor.select(variant); a.settings.set({ cameraShake: false });
      a.survivor.present({ carrying: '' }); a.teleport('player', { x: -62, z: -2 });
      const r = 8, p = a.getState().player!.transform;
      a.camera.cinematic({ target: [p.x, .7, p.z], position: [p.x + r * Math.sin(.3 * Math.PI) / Math.SQRT2, .7 + r * Math.cos(.3 * Math.PI), p.z + r * Math.sin(.3 * Math.PI) / Math.SQRT2] });
    }, variant);
    // Hide dialogue overlays only in this evidence view, keeping the courier unobstructed.
    await page.addStyleTag({ content: '.story-bubble,.mission-subtitle{visibility:hidden!important}' });
    await page.mouse.move(800, 450); await page.mouse.wheel(0, -3000);
    await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 60; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } await a.screenshotReady(); });
    const frames: Buffer[] = [], samples: unknown[] = [];
    const move = async (x = 0, z = 0, walk = false) => page.evaluate(v => window.__SS__!.input.set({ move: { x: v.x, z: v.z }, walk: v.walk }), { x, z, walk });
    const scene = async (label: string, ticks: number, fastClicks = false): Promise<void> => {
      for (let tick = 0; tick < ticks; tick++) {
        if (fastClicks && tick % 6 === 0) {
          // Real released Shift+LMB clicks, 10 Hz: exercise the gameplay queue.
          const p = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.input.project({ x: p.x + 1, z: p.z }); });
          await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
        }
        const s = await page.evaluate(async () => {
          const a = window.__SS__!, p = a.getState().player!.transform, r = 8;
          a.camera.cinematic({ target: [p.x, .7, p.z], position: [p.x + r * Math.sin(.3 * Math.PI) / Math.SQRT2, .7 + r * Math.cos(.3 * Math.PI), p.z + r * Math.sin(.3 * Math.PI) / Math.SQRT2] });
          a.vfx.stepRender(1 / 60); await a.step(1);
          const s = a.getState(); return { tick: s.tick, character: s.render.character, player: s.player, point: a.input.project(s.player!.transform), camera: s.render.camera };
        });
        if (tick % 3 === 0) {
          samples.push({ label, ...s });
          const x = Math.round(Math.min(1600 - 800, Math.max(0, s.point.x - 400))), y = Math.round(Math.min(900 - 600, Math.max(0, s.point.y - 390)));
          const clip = { x, y, width: 800, height: 600 };
          frames.push(await page.screenshot({ type: 'jpeg', quality: 85, clip }));
          if ([0, 12, 30, 60].includes(tick)) await page.screenshot({ path: `${out}/game-${variant}-${label}-${tick}.png`, clip });
        }
      }
      console.log(variant, label, ticks);
    };
    const encode = (name: string) => {
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '20', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '850k', '-crf', '18', `${out}/game-${variant}-${name}.webm`], { input: Buffer.concat(frames), maxBuffer: 1024 * 1024 });
      frames.length = 0;
    };
    if (!bikeOnly) {
      await scene('idle', 90); await move(1, 0, true); await scene('walk', 180); await move(); await scene('stop', 90);
      encode('idle-walk-stop');
      await move(1); await scene('run', 90); await move(-1); await scene('turn180', 75); await move(); await scene('turn-stop', 30);
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.fists'], ['weapon.kick']); });
      await scene('unarmed', 240, true);
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.bat'], ['weapon.fists']); });
      await scene('bat', 150, true); await scene('fight-recovery', 60);
      encode('run-turn-fight');
      await page.evaluate(() => { window.__SS__!.input.clear(); window.__SS__!.survivor.damage(1); }); await scene('hurt', 45);
      frames.length = 0;
    }
    await page.evaluate(async () => {
      const a = window.__SS__!, b = a.query({ kind: 'bicycle' })[0]; a.input.clear(); a.cheats.killAll();
      a.teleport('player', { x: b.transform.x + .9, z: b.transform.z });
      for (let i = 0; i < 2; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
      a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false });
      if (!a.getState().player!.riding) throw new Error(`Mount failed: ${JSON.stringify({ player: a.getState().player, bike: a.query({ kind: 'bicycle' })[0], input: a.getState().input })}`);
    });
    await scene('mount', 45);
    // Reposition the already mounted bike into the open street for ride/exit stills.
    await page.evaluate(() => window.__SS__!.teleport('player', { x: -58, z: -2 }));
    await move(1); await scene('ride', 90); await move(); await scene('ride-stop', 60);
    await page.evaluate(async () => { const a = window.__SS__!; a.input.clear(); a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false }); });
    await scene('dismount', 60); frames.length = 0;
    const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
    if (!bikeOnly && (!events.some(e => e.actionId === 'weapon.fists') || !events.some(e => e.actionId === 'weapon.bat'))) throw new Error('Fast clicks did not produce both attack chains');
    results.push({ variant, errors: guard.errors, events, samples });
    if (guard.errors.length) throw new Error(guard.errors.join('\n'));
  } finally { guard.dispose(); await close(); }
}
writeFileSync(`${out}/game-capture.json`, JSON.stringify(results));
