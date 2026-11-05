import type { Page } from '@playwright/test';
import { cure } from '../../src/levels/L10/district';
import type { Game } from '../../src/Game';

/** Chromium flags of the L10 probes: real GPU on macOS, SwiftShader elsewhere. */
export const l10LaunchArgs = process.platform === 'darwin'
  ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

/** Shared L10 charge fixture of the boss-fight probes: load the cure complex under god mode, introduce the
 * far Mega (the fixture skips the route's first 90 s, when it is normally introduced), install the charge and
 * hold E at the console with real key presses, then step `chargeTicks` more ticks. */
export async function chargeL10Console(origin: string, page: Page, quality: string, chargeTicks: number): Promise<void> {
  await page.goto(`${origin}/?test=poses&testApi=1&scenelab=1&renderer=webgl&dpr=1&audio=muted&quality=${quality}`);
  await page.waitForFunction(() => !!window.__SS__);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.ready;
    await a.loadLevel('L10', { seed: 327, checkpoint: 'cure-complex', progression: 'L10-default' });
    a.pause(); a.cheats.god(true); a.camera.follow();
    (window.__SCENE__ as unknown as { game: Game }).game.world.megaPursuit!.introduce();
  });
  const [ix, iz] = cure.anchors['cure-install'], [cx, cz] = cure.anchors['cure-console'];
  await page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x: ix, z: iz });
  await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(36)); await page.keyboard.up('e');
  await page.evaluate(() => window.__SS__!.step(1));
  await page.evaluate(({ x, z }) => window.__SS__!.teleport('player', { x, z }), { x: cx, z: cz });
  await page.keyboard.down('e'); await page.evaluate(() => window.__SS__!.step(1)); await page.keyboard.up('e');
  await page.evaluate(ticks => window.__SS__!.step(ticks), chargeTicks);
}
