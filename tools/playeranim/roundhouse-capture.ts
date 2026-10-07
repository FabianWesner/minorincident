import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import { open, origin } from '../skinpilot/browser';
import { attachErrorGuard } from '../../tests/e2e/fixtures';

/** Bat roundhouse evidence (00 §6.2): the real L1 renderer at the game camera, the skinned courier surrounded by 5
 * infected on a sidewalk, real released Shift+LMB clicks at 8 Hz. Writes a <= 10 s WebM and 3 stills (coil, mid-spin,
 * follow-through). Run after `npm run build`, through tools/e2e-lock.sh, on a dedicated preview port (E2E_PORT). */
const out = process.argv[2] ?? 'test-results/bat-roundhouse';
const ffmpeg = process.env.FFMPEG_BIN ?? `${homedir()}/Library/Caches/ms-playwright/ffmpeg-1011/ffmpeg-mac`;
mkdirSync(out, { recursive: true });
const { page, close } = await open(); const guard = attachErrorGuard(page);
try {
  await page.goto(`${origin}/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&seed=1&skin=1`);
  await page.waitForFunction(() => !!window.__SS__, null, { timeout: 120_000 });
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.ready; await a.loadLevel('L1', { seed: 1 });
    document.querySelector<HTMLButtonElement>('[data-testid=mission-button]')?.click();
    a.pause(); a.cheats.god(true); a.settings.set({ cameraShake: false });
    a.survivor.present({ carrying: '' }); a.teleport('player', { x: -45, z: -2.2 });
    a.setLoadout(['weapon.bat'], ['weapon.fists']);
  });
  await page.addStyleTag({ content: '.story-bubble,.mission-subtitle{visibility:hidden!important}' });
  const ring = () => page.evaluate(() => {
    const a = window.__SS__!, p = a.getState().player!.transform;
    for (let i = 0; i < 5; i++) {
      const angle = i * Math.PI * 2 / 5 + .3, r = 1.45 + (i % 2) * .25, x = p.x + Math.cos(angle) * r, z = p.z + Math.sin(angle) * r;
      a.spawn('infected.runner', { x, z }, { state: 'chase', yaw: -Math.atan2(p.z - z, p.x - x) });
    }
  });
  await ring();
  // Real game camera (follow), zoomed to the close end the wheel allows.
  await page.mouse.move(800, 450); await page.mouse.wheel(0, -3000);
  await page.evaluate(async () => { const a = window.__SS__!; for (let i = 0; i < 20; i++) { a.vfx.stepRender(1 / 60); await a.step(1); } await a.screenshotReady(); });
  const frames: Buffer[] = [], stills: { tick: number; name: string }[] = [];
  let sweeps = 0, still = 0;
  for (let tick = 0; tick < 540; tick++) {
    if (tick === 270) { await page.evaluate(() => window.__SS__!.cheats.killAll()); await ring(); }
    if (tick % 8 === 0) {
      const p = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform, e = a.query({ kind: 'infected', within: { x: p.x, z: p.z, r: 3 } }).filter(e => e.health.current > 0)[0]?.transform ?? { x: p.x + 1, z: p.z }; return a.input.project({ x: e.x, z: e.z }); });
      await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
    }
    const s = await page.evaluate(async () => {
      const a = window.__SS__!; a.vfx.stepRender(1 / 60); await a.step(1);
      const s = a.getState(), attack = s.player!.survivor?.attack;
      return { tick: s.tick, point: a.input.project(s.player!.transform), attack: attack ?? null };
    });
    const clip = { x: Math.round(Math.min(1600 - 960, Math.max(0, s.point.x - 480))), y: Math.round(Math.min(900 - 720, Math.max(0, s.point.y - 400))), width: 960, height: 720 };
    if (s.attack?.style === 'roundhouse') {
      const u = s.tick - s.attack.started, a = s.attack.activeAt - s.attack.started, r = s.attack.recoveryAt - s.attack.started;
      if (u === 1) sweeps++;
      // First roundhouse: coil, mid-spin, follow-through.
      for (const [name, at] of [['1-coil', a - 1], ['2-spin', a + Math.round((r - a) * .55)], ['3-follow-through', r + 2]] as const) {
        if (sweeps === 1 && u === at && still < 3) { await page.screenshot({ path: `${out}/${name}.png`, clip }); stills.push({ tick: s.tick, name }); still++; }
      }
    }
    if (tick % 3 === 0) frames.push(await page.screenshot({ type: 'jpeg', quality: 82, clip }));
  }
  execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-framerate', '20', '-i', 'pipe:0', '-c:v', 'libvpx', '-b:v', '700k', '-crf', '20', `${out}/bat-roundhouse.webm`], { input: Buffer.concat(frames), maxBuffer: 1 << 30 });
  const events = await page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack' || (e.type === 'combat.hit' && e.sourceId === 1)).map(e => ({ type: e.type, tick: e.tick, ...('style' in e ? { style: e.style } : {}), ...(e.type === 'combat.hit' ? { targetId: e.targetId, amount: e.amount } : {}) })));
  writeFileSync(`${out}/capture.json`, JSON.stringify({ frames: frames.length, seconds: frames.length / 20, stills, sweeps: events.filter(e => e.type === 'combat.attack' && 'style' in e).length, errors: guard.errors, events }, null, 1));
  console.log('frames', frames.length, 'sweeps', events.filter(e => e.type === 'combat.attack' && 'style' in e).length, 'stills', stills.map(s => s.name).join(','));
  if (guard.errors.length) throw new Error(guard.errors.join('\n'));
} finally { guard.dispose(); await close(); }
