import { writeFileSync } from 'node:fs';
import { test, expect, boot } from '../fixtures';
test.use({ launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu'] } });

import { l5Survivors } from '../../../src/data/l5';

test('PO #21b @E23 survivor-3: ordinary clicks lead from the wrong plaza bus to Sam, then keyboard reveals Mia', async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page, '/?test=1&renderer=webgl&dpr=1&quality=high&audio=muted&ui=1');
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L5', { seed: 1, progression: 'L5-default' }); a.pause();
  });
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(async () => {
    const a = window.__SS__!; a.pause(); a.cheats.god(true); a.cheats.completeObjective('emerge'); await a.step(661);

  });
  // Fixture reconstruction only: the first three finds are stored in the actual checkpoint.
  for (const key of ['rosa', 'dale', 'okafor']) {
    const def = l5Survivors.find(s => s.key === key)!;
    await page.evaluate(async at => { const a = window.__SS__!; a.teleport(1, { x: at[0], z: at[1] }); await a.step(65); }, def.ringAt);
  }
  await page.evaluate(async () => { const a = window.__SS__!; a.missions.restore('survivor-3'); a.teleport(1, { x: -9.96, z: 4.55 }); a.cheats.god(false); a.survivor.damage(Math.max(0, a.getEntity(1)!.health.current - 22)); a.cheats.god(true); a.camera.follow(); a.input.clear(); await a.step(90); await a.screenshotReady(); });
  await expect(page.locator('[data-testid="minimap-cue"]')).toHaveAttribute('data-survivor', 'sam');
  await expect(page.locator('[data-testid="sign-of-life"]')).toContainText('Lakeshore Avenue');
  await page.screenshot({ path: 'test-results/l5-po-2/wrong-bus-guidance.png' });
  for (const target of [{ x: -22, z: 15 }, { x: -26, z: 40 }, { x: -45, z: 42.6 }]) {
    for (let attempt = 0; attempt < 12; attempt++) {
      const state = await page.evaluate(target => {
        const a = window.__SS__!, p = a.getEntity(1)!.transform, d = Math.hypot(target.x - p.x, target.z - p.z);
        const f = Math.min(1, 4 / (d || 1));
        return { d, point: a.input.project({ x: p.x + (target.x - p.x) * f, z: p.z + (target.z - p.z) * f }) };
      }, target);
      if (state.d < 2) break;
      await page.mouse.click(state.point.x, state.point.y);
      await page.evaluate(async () => { await window.__SS__!.step(180); });
    }
  }
  await page.keyboard.down('e'); await page.evaluate(async () => { await window.__SS__!.step(70); await window.__SS__!.screenshotReady(); }); await page.keyboard.up('e');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l5!.survivors.find(r => r.key === 'sam')!.status)).toBe('following');
  await page.screenshot({ path: 'test-results/l5-po-2/sam-rescued.png' });
  writeFileSync('test-results/l5-po-2/sam-proof.json', JSON.stringify(await page.evaluate(() => ({ player: window.__SS__!.getEntity(1)!.transform, mission: window.__SS__!.missions.state()!.l5 })), null, 2));
  // Continue to the fifth survivor using the same ordinary click destinations, then E at the stairwell.
  for (const target of [{ x: -56, z: 22 }, { x: -56, z: -34 }, { x: -76.2, z: -44.4 }]) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const state = await page.evaluate(target => { const a = window.__SS__!, p = a.getEntity(1)!.transform, d = Math.hypot(target.x - p.x, target.z - p.z), f = Math.min(1, 4 / (d || 1)); return { d, point: a.input.project({ x: p.x + (target.x - p.x) * f, z: p.z + (target.z - p.z) * f }) }; }, target);
      if (state.d < 2) break;
      await page.mouse.click(state.point.x, state.point.y); await page.evaluate(async () => { await window.__SS__!.step(180); });
    }
  }
  await page.keyboard.down('e'); await page.evaluate(async () => { await window.__SS__!.step(70); await window.__SS__!.screenshotReady(); }); await page.keyboard.up('e');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l5!.survivors.find(r => r.key === 'mia')!.status)).toBe('following');
  await page.screenshot({ path: 'test-results/l5-po-2/mia-rescued.png' });
});

