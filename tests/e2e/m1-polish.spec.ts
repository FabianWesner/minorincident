import { mkdirSync, writeFileSync } from 'node:fs';
import { devices } from '@playwright/test';
import { test, expect, boot } from './fixtures';

const output = 'test-results/m1-polish';
for (const mode of ['desktop', 'portrait'] as const) test.describe(mode, () => {
  test.use({ viewport: mode === 'desktop' ? { width: 1600, height: 900 } : { width: 390, height: 844 }, hasTouch: mode === 'portrait', isMobile: mode === 'portrait', userAgent: mode === 'desktop' ? devices['Desktop Chrome'].userAgent : devices['iPhone 14'].userAgent });
  test(`VQA-08/09/12/13/14 @E19 real-input polish review ${mode}`, async ({ page, context }) => {
    test.setTimeout(240_000); mkdirSync(output, { recursive: true });
    await boot(page, `/?test=1&renderer=webgl&dpr=1&quality=${mode === 'desktop' ? 'high' : 'low'}&audio=muted&seed=42`);
    await page.evaluate(async () => { await window.__SS__!.loadLevel('L1', { seed: 42 }); });
    await page.getByTestId('mission-button').click();
    await page.evaluate(() => window.__SS__!.pause());
    const cdp = mode === 'portrait' ? await context.newCDPSession(page) : null;
    const measurements: unknown[] = [];
    const step = async (n: number) => { await page.evaluate(n => window.__SS__!.step(n), n); };
    const shot = async (label: string) => {
      // Clear transient hit flashes without changing simulation state or input.
      await page.evaluate(() => window.__SS__!.vfx.stepRender(.2));
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.screenshot({ path: `${output}/${mode}-${label}.png` });
      measurements.push(await page.evaluate(label => {
        const a = window.__SS__!, player = a.getState().player!;
        const tracker = document.querySelector<HTMLElement>('.mission-tracker')!;
        const toast = document.querySelector<HTMLElement>('.mission-toast')!, action = document.querySelector<HTMLElement>('[data-touch-action=interact]');
        const r = toast.getBoundingClientRect(), b = action?.getBoundingClientRect();
        const overlap = !toast.hidden && b && r.x < b.right && r.right > b.x && r.y < b.bottom && r.bottom > b.y;
        const live = a.query({ kind: 'infected' }).filter(e => e.health.current > 0);
        const gl = document.querySelector('canvas')!.getContext('webgl2')!, ext = gl.getExtension('WEBGL_debug_renderer_info');
        return { label, player: player.transform, kills: a.missions.state()!.stats.kills, tracker: tracker.textContent, actionOverlap: Boolean(overlap), nearest: live.map(e => Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string : '' };
      }, label));
      const data = measurements.at(-1) as { actionOverlap: boolean; tracker: string; gpu: string };
      expect(data.actionOverlap, label).toBe(false);
      expect(data.tracker).toMatch(/\d+\u00a0m$/);
      expect(data.gpu).not.toMatch(/SwiftShader|llvmpipe/i);
      writeFileSync(`${output}/${mode}-metrics.json`, JSON.stringify(measurements, null, 2));
    };
    const move = async (x: number, z: number, keyboard = false) => {
      for (let i = 0; i < 180; i++) {
        const p = await page.evaluate(() => window.__SS__!.getState().player!.transform), d = Math.hypot(x - p.x, z - p.z);
        if (d < .65) return;
        if (cdp) {
          const origin = { id: 1, x: 70, y: 506 }, dx = (x - p.x) / d, dz = (z - p.z) / d;
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [origin] });
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...origin, x: origin.x + (dx - dz) / Math.SQRT2 * 50, y: origin.y + (dx + dz) / Math.SQRT2 * 50 }] });
          await step(Math.min(24, Math.max(1, Math.floor(d / 6 * 60))));
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else if (keyboard) {
          const [origin, target] = await page.evaluate(({ p, x, z }) => [window.__SS__!.input.project(p), window.__SS__!.input.project({ x, z })], { p, x, z });
          const sx = target.x - origin.x, sy = target.y - origin.y;
          const keys = [Math.abs(sx) > 3 ? sx > 0 ? 'd' : 'a' : '', Math.abs(sy) > 3 ? sy > 0 ? 's' : 'w' : ''].filter(Boolean);
          for (const key of keys) await page.keyboard.down(key);
          await step(Math.min(12, Math.max(1, Math.floor(d / 6 * 60))));
          for (const key of keys) await page.keyboard.up(key);
        } else {
          const point = await page.evaluate(p => window.__SS__!.input.project(p), { x: p.x + (x - p.x) / d * Math.min(3, d), z: p.z + (z - p.z) / d * Math.min(3, d) });
          await page.mouse.click(point.x, point.y); await step(24);
        }
      }
      throw new Error(`Unable to walk to ${x},${z}: ${JSON.stringify(await page.evaluate(() => ({player: window.__SS__!.getState().player!.transform, mission: window.__SS__!.missions.state()})))}`);
    };
    const attack = async (side: 'left' | 'right') => {
      if (cdp) {
        const box = await page.getByTestId(`touch-${side}`).boundingBox(); expect(box).not.toBeNull();
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 }] });
        await step(42); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        const point = await page.evaluate(() => {
          const a = window.__SS__!, p = a.getState().player!.transform;
          const target = a.query({ kind: 'infected' }).filter(e => e.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - p.x, a.transform.z - p.z) - Math.hypot(b.transform.x - p.x, b.transform.z - p.z))[0];
          return a.input.project(target?.transform ?? p);
        });
        await page.mouse.move(point.x, point.y);
        // Keyboard attack mirrors mouse attack, holding position for the reported observer.
        const key = side === 'left' ? 'j' : 'k';
        await page.keyboard.down(key); await step(42); await page.keyboard.up(key);
      }
    };
    await move(-14, -4); await shot('start-separation'); await move(0, 0); await move(27, 0); await move(42, 0); await move(42, -6.5); await step(1); await shot('diner-toast-sign');
    for (let i = 0; i < 80; i++) {
      await step(30);
      if (await page.evaluate(() => window.__SS__!.missions.state()!.outbreak!.released)) break;
    }
    await shot('diner-contact');
    for (let i = 0; i < 15; i++) { await attack(i % 4 === 0 ? 'right' : 'left'); if (i % 2 === 0) await shot(`diner-combat-${i}`); }
    await step(120);
    await shot('diner-corpses');
    await move(42, 0); await move(56, 0); await shot('tracker-V5'); await move(70, 0); await move(70, -7); await shot('hardware-toast');
    await page.getByTestId('choose-bat').click();
    if (cdp) await page.getByTestId('touch-interact').tap(); else await page.keyboard.press('f');
    await step(1);
    await move(75, 0, true); await move(75, -4, true); await shot('hardware-contact');
    for (let i = 0; i < 24; i++) {
      await attack(i % 4 === 0 ? 'right' : 'left'); await shot(`hardware-combat-${i}`);
      if (await page.evaluate(() => window.__SS__!.missions.state()!.stats.kills >= 6)) break;
    }
    await step(120); await shot('hardware-corpses'); await step(540); await shot('hardware-faded');
    expect(await page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.hit' && e.sourceId === 1))).toBe(true);
    await cdp?.detach();
  });
});
