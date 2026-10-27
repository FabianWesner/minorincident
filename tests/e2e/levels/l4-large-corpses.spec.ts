import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';

const output = 'test-results/epics/E22/l4-no-tents';
test.use({ viewport: { width: 1280, height: 720 }, trace: 'off' });
for (const zoom of [1, 1.5]) test(`Q-193 Q-195 @E22 solid Alpha corpse and welded suit pile zoom ${zoom}`, async ({ page }) => {
  test.setTimeout(240_000); mkdirSync(output, { recursive: true });
  await boot(page, '/?test=1&renderer=webgl&quality=low&dpr=1&audio=muted&scenelab=1');
  const ids = await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadScenario('horde-arena'); a.pause(); a.cheats.god(true);
    a.cheats.killAll(); await a.step(121);
    a.teleport('player', { x: 0, z: 0 });
    const alpha = a.spawn('infected.alpha', { x: 4, z: 4 }, { yaw: Math.PI / 2 });
    const suits = Array.from({ length: 8 }, (_, i) => a.spawn('infected.runner', { x: 1 + i % 4, z: -3 - Math.floor(i / 4) }, { variant: 'inf.common-worker', yaw: i * .7 }));
    a.cheats.killAll(); await a.step(125); a.camera.follow();
    return { alpha, suits };
  });
  for (let i = 0; i < 30; i++) {
    const z = await page.evaluate(() => window.__SS__!.getState().render.camera.targetZoom as number);
    if (Math.abs(z - zoom) < .02) break;
    await page.mouse.move(640, 360); await page.mouse.wheel(0, z > zoom ? -120 : 120); await page.evaluate(() => window.__SS__!.step(2));
  }
  const proof = await page.evaluate(async ({ alpha, suits }) => {
    const a = window.__SS__!;
    a.input.set({ move: { x: 1, z: 1 } }); await a.step(100); a.input.clear(); await a.step(2); await a.screenshotReady();
    const player = a.getEntity(1)!.transform, body = a.getEntity(alpha)!;
    return { player, alpha: body.transform, separation: Math.hypot(player.x - body.transform.x, player.z - body.transform.z), foreground: a.getState().render.courierForeground, alphaDrawn: a.crowdFigures().some(f => f.id === alpha && f.drawn), suitsDrawn: suits.filter(id => a.crowdFigures().some(f => f.id === id && f.drawn)).length, retained: suits.filter(id => a.getEntity(id)?.corpse).length };
  }, ids);
  expect(proof.separation).toBeGreaterThanOrEqual(1.2);
  expect(proof.player.x).toBeGreaterThan(1);
  expect(proof.foreground).toBe(true);
  expect(proof.alphaDrawn).toBe(true);
  expect(proof.retained).toBe(8); expect(proof.suitsDrawn).toBe(8);
  await page.screenshot({ path: `${output}/alpha-contact-and-suit-pile-z${zoom}.png` });
  writeFileSync(`${output}/alpha-contact-z${zoom}.json`, JSON.stringify(proof, null, 2) + '\n');
  // Small bodies remain walkable, but their accumulated meshes must not hide the courier either.
  const pile = await page.evaluate(async () => {
    const a = window.__SS__!; a.teleport('player', { x: 2.5, z: -3.5 }); await a.step(2); await a.screenshotReady();
    return { foreground: a.getState().render.courierForeground, at: a.getEntity(1)!.transform };
  });
  expect(pile.foreground).toBe(true);
  expect(Math.hypot(pile.at.x - 2.5, pile.at.z + 3.5)).toBeLessThan(.1);
  await page.screenshot({ path: `${output}/walkable-suit-pile-z${zoom}.png` });
});
