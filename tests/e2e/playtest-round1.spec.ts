import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import { menuStart, menuUrl } from './ui-helpers';
// L1 v2 replaced the diner/hardware story these checks assume; the L1 v2 playthrough is tests/e2e/levels/L1.spec.ts.
test.beforeEach(() => { test.fixme(true, 'old L1 diner flow retired (L1 v2)'); });

// Opt-in exploration: five minutes in L1 plus live AI combat per viewport.
// PLAYTEST_ROUND1=1 E2E_PORT=3334 npm run test:e2e -- tests/e2e/playtest-round1.spec.ts --workers=2
const output = 'test-results/playtest';
for (const mode of ['desktop', 'portrait', 'landscape'] as const) {
  test.describe(mode, () => {
    test.use({ hasTouch: mode !== 'desktop', isMobile: mode !== 'desktop', viewport: mode === 'desktop' ? { width: 1600, height: 900 } : mode === 'portrait' ? { width: 412, height: 915 } : { width: 915, height: 412 } });
    test(`round-1 exploratory ${mode}`, async ({ page, context }) => {
      test.skip(process.env.PLAYTEST_ROUND1 !== '1', 'Opt-in simulated player exploration');
      test.setTimeout(600_000); mkdirSync(output, { recursive: true });
      if (mode === 'desktop') await menuStart(page);
      else {
        await page.goto(menuUrl);
        for (const id of ['start-game', 'character-female', 'level-L1', 'mission-button']) await page.getByTestId(id).tap();
        await expect(page.getByTestId('pause-button')).toBeVisible();
      }
      await page.evaluate(() => window.__SS__!.pause());
      const cdp = mode === 'desktop' ? null : await context.newCDPSession(page);
      let ticks = 0;
      const samples: unknown[] = [];
      const step = async (n: number) => { await page.evaluate(n => window.__SS__!.step(n), n); ticks += n; };
      const sample = async (label: string) => {
        samples.push({ label, ticks, state: await page.evaluate(() => window.__SS__!.getState()), events: await page.evaluate(() => window.__SS__!.events().filter(e => e.type !== 'sim.tick')), hud: await page.getByTestId('hud').innerText() });
        writeFileSync(`${output}/${mode}.json`, JSON.stringify({ mode, ticks, simulatedSeconds: ticks / 60, samples }, null, 2));
      };
      const shot = async (label: string) => {
        await page.evaluate(() => window.__SS__!.screenshotReady());
        await page.screenshot({ path: `${output}/${mode}-${label}.png` });
        await sample(label);
      };
      const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd', points: { id: number; x: number; y: number }[]) => {
        await cdp!.send('Input.dispatchTouchEvent', { type, touchPoints: points });
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      };
      const move = async (dx: number, dz: number, n = 60) => {
        const length = Math.hypot(dx, dz) || 1;
        const x = (dx - dz) / Math.SQRT2 / length, y = (dx + dz) / Math.SQRT2 / length;
        if (cdp) {
          const start = { id: 1, x: page.viewportSize()!.width * .2, y: page.viewportSize()!.height * .55 };
          await touch('touchStart', [start]); await touch('touchMove', [{ ...start, x: start.x + x * 60, y: start.y + y * 60 }]);
          await step(n); await touch('touchEnd', []);
        } else {
          const keys = [...(Math.abs(x) > .25 ? [x > 0 ? 'd' : 'a'] : []), ...(Math.abs(y) > .25 ? [y > 0 ? 's' : 'w'] : [])];
          for (const key of keys) await page.keyboard.down(key);
          await step(n);
          for (const key of keys) await page.keyboard.up(key);
        }
      };
      const attack = async (side: 'left' | 'right', drag = false) => {
        if (cdp) {
          const box = await page.getByTestId(`touch-${side}`).boundingBox(); expect(box).not.toBeNull();
          const p = { id: 2, x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
          await touch('touchStart', [p]);
          if (drag) await touch('touchMove', [{ ...p, x: p.x - 40, y: p.y - 40 }]);
          await touch('touchEnd', []); await step(45);
        } else {
          const point = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.input.project({ x: p.x + 5, z: p.z }); });
          await page.mouse.move(point.x, point.y); await page.mouse.down({ button: side }); await step(45); await page.mouse.up({ button: side });
        }
      };
      const next = async () => {
        if (cdp) await page.getByTestId('touch-selector').tap(); else await page.keyboard.press('q');
        await step(20);
      };
      await shot('start');
      if (!cdp) {
        const point = await page.evaluate(() => { const a = window.__SS__!, p = a.getState().player!.transform; return a.input.project({ x: p.x + .5, z: p.z }); });
        await page.mouse.move(point.x, point.y);
        await page.mouse.down({ button: 'left' }); await step(1);
        await page.mouse.down({ button: 'right' }); await step(1); await sample('both-buttons-held');
        await page.mouse.up({ button: 'left' }); await step(1);
        await page.mouse.up({ button: 'right' }); await step(1); await sample('both-buttons-released');
        await page.getByTestId('pause-button').click(); await page.getByTestId('resume-game').click();
        await page.evaluate(() => window.__SS__!.pause());
      }
      // Route toward the real first objectives, reading authored anchors rather than teleporting.
      const anchors = await page.evaluate(async () => {
        const d = await (await fetch('/assets/layouts/D-MAIN.layout.json')).json();
        return d.anchors;
      });
      const diner = anchors['diner-door'].position;
      for (let i = 0; i < 70; i++) {
        const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
        const dx = diner[0] + 56 - p.x, dz = diner[2] - p.z;
        if (Math.hypot(dx, dz) < 1.8) break;
        // Try the roads around obstacles when straight steering stalls.
        const detour = i % 20 >= 15;
        await move(detour ? 0 : dx, detour ? 5 : dz);
        if (i % 10 === 0) { await attack('right'); await sample(`route-${i}`); }
      }
      await step(12); await shot('diner-route');
      const hardware = anchors['hardware-display'].position;
      for (let i = 0; i < 40; i++) {
        const state = await page.evaluate(() => window.__SS__!.getState());
        if (!state.mission?.completedObjectives.includes('breakfast')) break;
        const dx = hardware[0] + 56 - state.player!.transform.x, dz = hardware[2] - state.player!.transform.z;
        if (Math.hypot(dx, dz) < 1.5) { await step(60); break; }
        await move(dx, dz, 30);
      }
      await shot('hardware-route');
      // Explore props/doors nearby, walk to pickups and use both racks. Debug hooks
      // supply catalog items absent from the early level; all consumption is physical input.
      const fixtures = await page.evaluate(() => {
        const a = window.__SS__!, p = a.getState().player!.transform;
        return { door: a.spawn('device.door', { x: p.x + 1.3, z: p.z }, { label: 'Playtest door' }), pickup: a.spawn('weapon.bat', { x: p.x + 1, z: p.z + 1 }) };
      });
      await move(1, 1, 14); await step(60);
      if (!cdp) { await page.keyboard.press('e'); await step(60); }
      await sample(`interactions-${JSON.stringify(fixtures)}`);
      await page.evaluate(() => window.__SS__!.setLoadout(['weapon.fists', 'weapon.pistol', 'weapon.grenade'], ['weapon.kick', 'weapon.shotgun', 'weapon.molotov']));
      for (let rack = 0; rack < 3; rack++) {
        for (let i = 0; i < 6; i++) { await attack('left', i % 2 === 0); await attack('right', i % 2 === 0); }
        await shot(`rack-${rack}`);
        await next(); await attack('left'); await next();
      }
      // Fight live infected without god mode; let them land attacks too.
      await page.evaluate(() => {
        const a = window.__SS__!, p = a.getState().player!.transform;
        for (let i = 0; i < 4; i++) a.spawn('infected.runner', { x: p.x + 2 + i, z: p.z + i - 2 });
      });
      for (let i = 0; i < 12; i++) { await attack('left'); await attack('right', true); await move(i % 2 ? -1 : 1, 1, 60); }
      await shot('fight');
      if (cdp) await page.getByTestId('pause-button').tap(); else await page.keyboard.press('Escape');
      await expect(page.getByTestId('menu-pause')).toBeVisible();
      const pausedTick = await page.evaluate(() => window.__SS__!.tick());
      await page.waitForTimeout(250); expect(await page.evaluate(() => window.__SS__!.tick())).toBe(pausedTick);
      if (cdp) await page.getByTestId('resume-game').tap(); else await page.getByTestId('resume-game').click();
      await page.evaluate(() => window.__SS__!.pause());
      await shot('resume');
      // Continue actively exploring the real level to five minutes per viewport.
      let turn = 0;
      while (ticks < 18_000) {
        await move([1, 0, -1, 0][turn % 4], [0, 1, 0, -1][turn % 4], 120);
        await attack(turn % 2 ? 'left' : 'right', true); turn++;
        if (turn % 10 === 0) { await next(); await sample(`explore-${turn}`); }
      }
      await shot('level-end');
      // L1 currently has no infected system: separately exercise live AI combat,
      // damage and recovery through the same physical controls in horde-arena.
      await page.evaluate(async () => {
        const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause();
        a.survivor.select('female'); a.setLoadout(['weapon.bat', 'weapon.pistol', 'weapon.grenade'], ['weapon.kick', 'weapon.shotgun', 'weapon.molotov']);
        for (let i = 0; i < 3; i++) a.spawn('infected.runner', { x: 2 + i, z: i - 1 }, { yaw: Math.PI });
      });
      await step(180); await shot('ai-damage');
      while (ticks < 24_000) {
        await attack('left'); await attack('right', true);
        await move([1, 0, -1, 0][turn % 4], [0, 1, 0, -1][turn % 4], 120); turn++;
        if (turn % 5 === 0) { await next(); await sample(`ai-fight-${turn}`); }
      }
      await shot('end');
      expect(ticks).toBeGreaterThanOrEqual(24_000);
    });
  });
}
