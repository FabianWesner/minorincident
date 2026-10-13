import { mkdirSync } from 'node:fs';
import { test } from './fixtures';
import { l2Anchors } from '../../src/data/l2';
// PO 10-13: world pickups carry one marker language (item glow + one small stand ring + at most the objective arrow).
// Capture-only: set PICKUP_SHOTS to a folder; levels via PICKUP_LEVELS (default all).
const dir = process.env.PICKUP_SHOTS ?? 'test-results/pickup-clarity';
const levels = (process.env.PICKUP_LEVELS ?? 'L1,L2,L3,L4,L5,L7').split(',');
const progression = (level: string) => (['L1', 'L7'].includes(level) ? undefined : `${level}-default`);
for (const level of levels) for (const quality of ['high', 'low']) for (const zoom of [1, 0.6]) {
  test(`pickup capture ${level} ${quality} zoom ${zoom}`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto(`/?test=1&renderer=webgl&dpr=1&quality=${quality}&audio=muted&seed=2`);
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async ({ level, progression }) => {
      const a = window.__SS__!; await a.ready;
      await a.loadLevel(level, { seed: 2, progression } as never); a.pause(); try { a.missions.begin(); } catch { /* level without mission */ } a.cheats.god(true); a.camera.follow(); await a.step(1);
    }, { level, progression: progression(level) });
    // L2: stand at the axe rack. Other levels: spawn the level's weapon pickup beside the player in the open (same pickup system and markers as the authored ones).
    const heading = await page.evaluate(async ({ level, axe, weapon }) => {
      const a = window.__SS__!;
      if (level === 'L2') { a.missions.teleport('player', { x: axe[0] + 1, z: axe[1] + 1 }); await a.step(30); return 'axe rack'; }
      const p = a.getState().player!.transform;
      a.spawn(weapon, { x: p.x + 1.8, z: p.z + 1.8 }); await a.step(30); return weapon;
    }, { level, axe: l2Anchors['l2-axe-rack'] as unknown as number[], weapon: ({ L1: 'weapon.bat', L3: 'weapon.handgun', L4: 'weapon.machine-gun', L5: 'weapon.handgun', L7: 'weapon.rocket-launcher' } as Record<string, string>)[level] ?? 'weapon.bat' });
    for (let i = 0; i < 12; i++) {
      const z = await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom);
      if (Math.abs(z - zoom) < 0.05) break;
      await page.mouse.move(800, 450); await page.mouse.wheel(0, z > zoom ? 120 : -120); await page.waitForTimeout(80);
    }
    await page.evaluate(async () => { await window.__SS__!.step(40); await window.__SS__!.screenshotReady(); });
    mkdirSync(dir, { recursive: true });
    await page.screenshot({ path: `${dir}/${level}-${quality}-z${zoom}.png` });
    console.log(level, quality, zoom, heading);
  });
}
