import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
import { companionReadability } from './companion-readability';

for (const quality of ['high', 'low'] as const) test(`L6 companion outside sodium pool contrast ${quality}`, async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page, `/?test=1&scenelab=1&renderer=webgl&quality=${quality}&dpr=1&audio=muted`);
  await page.evaluate(async quality => {
    const a = window.__SS__!; await a.loadLevel('L6', { seed: 1 }); a.pause(); a.settings.set({ quality });
    const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
    const dog = [...game.world.entities.iterate()].find(e => e.companion)!;
    // Behind the arrival platform's supply-crate pool, beyond the survivor's 2.4 m glow.
    a.teleport(dog.id, { x: game.world.entities.get(1)!.transform.x - 2.8, z: game.world.entities.get(1)!.transform.z + 1 });
    game.view.view.follow(); game.view.view.pull(0, 0, 0);
    for (let i = 0; i < 4; i++) game.view.update(1);
    await a.screenshotReady();
  }, quality);
  await page.addStyleTag({ content: 'body > :not(#game), #game > :not(canvas) { visibility:hidden!important }' });
  const result = await companionReadability(page);
  const out = 'test-results/epics/E24/companion'; mkdirSync(out, { recursive: true });
  writeFileSync(`${out}/${quality}.json`, JSON.stringify(result, null, 2));
  await page.locator('canvas').first().screenshot({ path: `${out}/${quality}.png` });
  expect(result.pixels).toBeGreaterThan(40);
  expect(result.contrast).toBeGreaterThanOrEqual(3);
});
