import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { open, origin } from '../skinpilot/browser';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

/** Game-camera evidence for the courier figure: idle/walk/stop, click-to-move turns (the PO's
 * input), keyboard run/turn, fast-click fights, hurt and the bike, for skin=1 and skin=0 side by
 * side. Actual L1 renderer, 25° game FOV at an 8 m review radius, every sim pose at 60 Hz,
 * captured at 20 fps. Run through e2e-lock against a Vite server on E2E_PORT.
 *   npx tsx tools/playeranim/fable-capture.ts <out> --tag=before --skin=1 [--variant=female] [--only=turns] */
const args = process.argv.slice(2), out = args.find(a => !a.startsWith('--')) ?? 'test-results/player-anim-fable';
const option = (name: string, fallback: string) => args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const tag = option('tag', 'after'), skin = option('skin', '1'), only = option('only', ''), variants = option('variant', 'female,male').split(',') as ('female' | 'male')[];
const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
mkdirSync(out, { recursive: true });
const results: unknown[] = [];
const polar = .3 * Math.PI, radius = 8;
for (const variant of variants) {
  const { page, close } = await open(); const guard = attachErrorGuard(page);
  const stem = `${out}/${tag}-skin${skin}-${variant}`;
  try {
    await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1&skin=${skin}`);
    await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
    await page.evaluate(async ({ variant, polar, radius }) => {
      const a = window.__SS__!; await a.ready; await a.loadLevel('L1', { seed: 1 });
      document.querySelector<HTMLButtonElement>('[data-testid=mission-button]')?.click();
      a.pause(); a.cheats.god(true); a.survivor.select(variant); a.settings.set({ cameraShake: false });
      a.survivor.present({ carrying: '' }); a.teleport('player', { x: -62, z: -2 });
      const p = a.getState().player!.transform;
      a.camera.cinematic({ target: [p.x, .7, p.z], position: [p.x + radius * Math.sin(polar) / Math.SQRT2, .7 + radius * Math.cos(polar), p.z + radius * Math.sin(polar) / Math.SQRT2] });
    }, { variant, polar, radius });
    await page.addStyleTag({ content: '.story-bubble,.mission-subtitle{visibility:hidden!important}' });
    await page.mouse.move(800, 450); await page.mouse.wheel(0, -3000);
    await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 60; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } await a.screenshotReady(); });
    const frames: Buffer[] = [], samples: unknown[] = [];
    const move = async (x = 0, z = 0, walk = false) => page.evaluate(v => window.__SS__!.input.set({ move: { x: v.x, z: v.z }, walk: v.walk }), { x, z, walk });
    /** Click-to-move relative to the current facing: `turn` radians from the heading, `distance` metres. */
    const clickRelative = async (turn: number, distance: number) => page.evaluate(({ turn, distance }) => {
      const a = window.__SS__!, p = a.getState().player!.transform, yaw = p.yaw + turn;
      a.input.set({ moveTarget: { x: p.x + Math.cos(yaw) * distance, z: p.z - Math.sin(yaw) * distance } });
    }, { turn, distance });
    const scene = async (label: string, ticks: number, fastClicks = false, stills = [0, 12, 30, 60]): Promise<void> => {
      for (let tick = 0; tick < ticks; tick++) {
        if (fastClicks && tick % 6 === 0) {
          const p = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.input.project({ x: p.x + 1, z: p.z }); });
          await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
        }
        const s = await page.evaluate(async ({ polar, radius }) => {
          const a = window.__SS__!, p = a.getState().player!.transform;
          a.camera.cinematic({ target: [p.x, .7, p.z], position: [p.x + radius * Math.sin(polar) / Math.SQRT2, .7 + radius * Math.cos(polar), p.z + radius * Math.sin(polar) / Math.SQRT2] });
          a.vfx.stepRender(1 / 60); await a.step(1);
          const s = a.getState(); return { tick: s.tick, character: s.render.character, player: s.player, point: a.input.project(s.player!.transform) };
        }, { polar, radius });
        if (tick % 3 === 0) {
          samples.push({ label, ...s });
          const x = Math.round(Math.min(1600 - 800, Math.max(0, s.point.x - 400))), y = Math.round(Math.min(900 - 600, Math.max(0, s.point.y - 390)));
          const clip = { x, y, width: 800, height: 600 };
          frames.push(await page.screenshot({ type: 'jpeg', quality: 85, clip }));
          if (stills.includes(tick)) await page.screenshot({ path: `${stem}-${label}-${tick}.png`, clip });
        }
      }
      console.log(tag, 'skin', skin, variant, label, ticks);
    };
    const encode = (name: string) => {
      execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '20', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '850k', '-crf', '18', `${stem}-${name}.webm`], { input: Buffer.concat(frames), maxBuffer: 64 * 1024 * 1024 });
      frames.length = 0;
    };
    const want = (group: string) => !only || only.split(',').includes(group);
    if (want('walk')) {
      await scene('idle', 90); await move(1, 0, true); await scene('walk', 150); await move(); await scene('stop', 60);
      encode('idle-walk-stop');
    }
    if (want('turns')) {
      // The PO's input: click-to-move. Turn 180° from standing, then 90° and 180° while moving.
      await clickRelative(Math.PI, 4); await scene('click-turn180-idle', 90, false, [0, 6, 12, 18, 24, 30, 45]);
      await clickRelative(Math.PI / 2, 4); await scene('click-turn90-move', 75, false, [0, 6, 12, 18, 24, 30]);
      await clickRelative(Math.PI, 4); await scene('click-turn180-move', 75, false, [0, 6, 12, 18, 24, 30]);
      await page.evaluate(() => window.__SS__!.input.set({ cancelMove: true })); await scene('click-stop', 45);
      await page.evaluate(() => window.__SS__!.input.clear());
      encode('click-turns');
    }
    if (want('run')) {
      await move(1); await scene('run', 90); await move(-1); await scene('run-turn180', 75, false, [0, 6, 12, 18, 24, 30, 45]); await move(0, 1); await scene('run-turn90', 60, false, [0, 6, 12, 18, 24, 30]); await move(); await scene('run-stop', 45);
      encode('run-turns');
    }
    if (want('fight')) {
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.fists'], ['weapon.kick']); });
      await scene('unarmed', 240, true);
      await page.evaluate(() => { const a = window.__SS__!; a.input.clear(); a.setLoadout(['weapon.bat'], ['weapon.fists']); });
      await scene('bat', 150, true); await scene('fight-recovery', 60);
      encode('fight');
      await page.evaluate(() => { window.__SS__!.input.clear(); window.__SS__!.survivor.damage(1); }); await scene('hurt', 45);
      frames.length = 0;
    }
    if (want('bike')) {
      await page.evaluate(async () => {
        const a = window.__SS__!, b = a.query({ kind: 'bicycle' })[0]; a.input.clear(); a.cheats.killAll();
        a.teleport('player', { x: b.transform.x + .9, z: b.transform.z });
        for (let i = 0; i < 2; i++) { a.vfx.stepRender(1 / 60); await a.step(1); }
        a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false });
        if (!a.getState().player!.riding) throw new Error(`Mount failed: ${JSON.stringify({ player: a.getState().player, bike: a.query({ kind: 'bicycle' })[0] })}`);
      });
      await scene('mount', 45);
      await page.evaluate(() => window.__SS__!.teleport('player', { x: -58, z: -2 }));
      await move(1); await scene('ride', 90); await move(); await scene('ride-stop', 60);
      await page.evaluate(async () => { const a = window.__SS__!; a.input.clear(); a.input.set({ interact: true }); a.vfx.stepRender(1 / 60); await a.step(1); a.input.set({ interact: false }); });
      await scene('dismount', 60);
      encode('bike');
    }
    const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack'));
    if (want('fight') && (!events.some(e => e.actionId === 'weapon.fists') || !events.some(e => e.actionId === 'weapon.bat'))) throw new Error('Fast clicks did not produce both attack chains');
    results.push({ variant, skin, tag, errors: guard.errors, attacks: events.length, samples });
    if (guard.errors.length) throw new Error(guard.errors.join('\n'));
  } finally { guard.dispose(); await close(); }
}
writeFileSync(`${out}/${tag}-skin${skin}-capture.json`, JSON.stringify(results));
