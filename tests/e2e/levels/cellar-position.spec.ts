import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import type { Page } from '@playwright/test';
import { test, expect, boot, testUrl } from '../fixtures';
import { levelFourLayouts } from '../../../src/levels/L4/layout';
import { levelFiveLayouts } from '../../../src/levels/L5/layout';
import type { DistrictLayout } from '../../../src/levels/districts/types';

const base = JSON.parse(readFileSync('public/assets/layouts/D-FAIR.layout.json', 'utf8')) as DistrictLayout;
const door = levelFourLayouts([base])[0].anchors['l4-cellar-door'].position;
const outside = levelFiveLayouts([base])[0].anchors['l5-out'].position;

/** PO 2026-10-12: "The hidden is behind a building" / "This isn't a visibility problem. It's a positioning problem."
 * Real keyboard input: the courier walks Harbor Street to Kessler's relocated cellar door, descends, walks to the brace (L4 end) and L5 starts in the
 * same cellar; the game camera (follow) must show the door, the yard and the objective ring without a building in front. Captures go to
 * test-results/epics/E22/cellar-position (the lane that wrote this looked at every one). */
const output = 'test-results/epics/E22/cellar-position';
test.use({ trace: 'off' });

const dominantShare = (buf: Buffer) => {
  const p = PNG.sync.read(buf), buckets = new Map<number, number>(); let n = 0;
  for (let i = 0; i < p.data.length; i += 4 * 5) { const key = (p.data[i] >> 4) << 8 | (p.data[i + 1] >> 4) << 4 | p.data[i + 2] >> 4; buckets.set(key, (buckets.get(key) ?? 0) + 1); n++; }
  return Math.max(...buckets.values()) / n;
};
const pos = (page: Page) => page.evaluate(() => { const t = window.__SS__!.getState().player!.transform; return { x: t.x, z: t.z }; });
/** `max`: in the yard the empty east lot around it is one dark flat ground colour (up to ~60% of the frame); the failure guarded is a building filling the view. */
const shot = async (page: Page, name: string, max = .5) => {
  await page.evaluate(() => window.__SS__!.camera.follow()); await page.evaluate(() => window.__SS__!.step(8));
  await page.evaluate(() => window.__SS__!.screenshotReady());
  const buf = await page.locator('canvas').first().screenshot(); writeFileSync(`${output}/${name}.png`, buf);
  expect(dominantShare(buf), `${name}: one colour fills the frame`).toBeLessThan(max);
};
/** Hold keys (world directions of the isometric follow camera: D+S east, A+S south) until `done` or the step budget ends. */
const walk = async (page: Page, keys: string[], done: (p: { x: number; z: number }) => boolean, steps = 40) => {
  await page.evaluate(() => window.__SS__!.resume());
  for (const k of keys) await page.keyboard.down(k);
  for (let i = 0; i < steps && !done(await pos(page)); i++) await page.waitForTimeout(150);
  for (const k of keys) await page.keyboard.up(k);
  await page.evaluate(() => window.__SS__!.pause());
};
const hold = async (page: Page, key: string, until: () => Promise<boolean>) => {
  for (let i = 0; i < 12 && !await until(); i++) { await page.keyboard.down(key); await page.evaluate(() => window.__SS__!.step(40)); await page.keyboard.up(key); await page.evaluate(() => window.__SS__!.step(5)); }
};

test.describe('Kessler cellar position', () => {
  test('T-E22-cellar-pos @E22 L4 end: Harbor pavement, door, descent, brace; L5 start in the same yard (game camera captures)', async ({ page }) => {
    test.setTimeout(420_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    await boot(page, `${testUrl}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L4', { seed: 1, progression: 'L4-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(async () => {
      const a = window.__SS__!; a.pause(); a.cheats.god(true);
      for (const id of ['ride', 'quartermaster']) { a.cheats.completeObjective(id); await a.step(30); }
      // The collapse director (PO 2026-10-12 design, approved "ok let's try that!") breaks the third line about 190 s after the turn (sim: turn 46 s, "Fall back!" 236 s after the gun): 350 s budget.
      a.teleport(1, { x: -21.5, z: 3 });
      for (let i = 0; i < 700 && !a.missions.state()!.l4!.lineBreakAt; i++) await a.step(30);
      a.teleport(1, { x: -64, z: -44.2 }); a.camera.follow(); await a.step(5);
    });
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.steps.hide.status)).toBe('active');
    await page.evaluate(() => document.body.classList.add('ui-hidden'));
    await shot(page, 'l4-01-harbor-approach');
    await walk(page, ['a', 'w'], p => p.x < door[0] + .5);
    expect(Math.hypot((await pos(page)).x - door[0], (await pos(page)).z - door[2]), 'reached the door ring').toBeLessThan(1.4);
    await shot(page, 'l4-02-at-the-cellar-door');
    await hold(page, 'e', async () => (await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)) === 'cellar');
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.phase)).toBe('cellar');
    await page.evaluate(() => window.__SS__!.step(60));
    const inside = await pos(page);
    expect(Math.hypot(inside.x - 75, inside.z + 4), 'arrived in the east-lot cellar yard').toBeLessThan(6);
    await shot(page, 'l4-03-in-the-cellar-yard', .7);
    await walk(page, ['a', 's'], p => p.z > -1.8);
    await shot(page, 'l4-04-at-the-brace', .7);
    await hold(page, 'e', async () => (await page.evaluate(() => window.__SS__!.missions.state()!.l4!.barredAt)) > 0);
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.l4!.barredAt)).toBeGreaterThan(0);
  });

  test('T-E23-cellar-pos @E23 L5 start: the courier stands in the cellar yard under the game camera, the brace is reachable by keyboard and unbarring steps out on Kessler Lane', async ({ page }) => {
    test.setTimeout(300_000); page.setDefaultTimeout(120_000); mkdirSync(output, { recursive: true });
    await boot(page, `${testUrl}&ui=1`);
    await page.evaluate(() => window.__SS__!.loadLevel('L5', { seed: 1, progression: 'L5-default' }));
    await page.evaluate(() => window.__SS__!.pause());
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => { window.__SS__!.pause(); window.__SS__!.cheats.god(true); document.body.classList.add('ui-hidden'); });
    await page.evaluate(() => window.__SS__!.step(60));
    const start = await pos(page);
    expect(Math.hypot(start.x - 75, start.z + 4), 'L5 starts in the east-lot cellar yard').toBeLessThan(6);
    await shot(page, 'l5-01-start-in-the-cellar', .7);
    await walk(page, ['a', 's'], p => p.z > -1.8);
    await shot(page, 'l5-02-at-the-brace', .7);
    await hold(page, 'e', async () => (await page.evaluate(() => window.__SS__!.missions.state()!.l5!.phase)) !== 'cellar');
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.l5!.phase)).not.toBe('cellar');
    await page.evaluate(() => window.__SS__!.step(30));
    const out = await pos(page);
    expect(Math.hypot(out.x - outside[0], out.z - outside[2]), 'steps out on Harbor Street (l5-out)').toBeLessThan(3);
    await shot(page, 'l5-03-outside-on-harbor-street');
  });
});
