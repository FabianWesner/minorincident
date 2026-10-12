import { mkdirSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { preset } from '../../../src/sim/progression/Campaign';
import { l2Anchors } from '../../../src/data/l2';

/** PO 2026-10-12: L2 must start with the bat only (no axe in hands), the axe ring must be reachable and visible, and bench sitters sit on the bench. */
const output = process.env.L2_START_OUT ?? 'test-results/epics/l2-start';
test.use({ trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] } });

const holds = (page: import('@playwright/test').Page) => page.evaluate(() => { const w = window.__SS__!.getState().player!.weapons!; return { left: w.LEFT.rack.map(s => s.id), right: w.RIGHT.rack.map(s => s.id) }; });

for (const entry of ['handover', 'level-select'] as const) {
  test(`T-L2-start-${entry} @l2start no axe before pickup; real input walks into the ring, takes and equips the axe`, async ({ page }) => {
    test.setTimeout(300_000); mkdirSync(output, { recursive: true });
    await boot(page, `${testUrl}&ui=1`);
    if (entry === 'handover') {
      await page.evaluate(() => window.__SS__!.loadLevel('L2', { seed: 1, progression: 'L2-default' }));
    } else {
      // A save that already owns and racks the axe (a replay after L2 / Continue) must still start without it.
      const save = preset('L3-default');
      await page.evaluate(save => { const a = window.__SS__!; a.campaign.restore(save); a.campaign.save(); a.campaign.menu(); }, save);
      await page.getByRole('button', { name: 'Level select', exact: true }).click();
      await page.getByRole('button', { name: 'Level 2', exact: true }).click();
    }
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(() => window.__SS__!.pause());
    const state = () => page.evaluate(() => window.__SS__!.missions.state()!);
    await page.evaluate(() => window.__SS__!.step(60));
    const before = await holds(page);
    expect([...before.left, ...before.right]).not.toContain('weapon.fire-axe');
    expect(before.left).toContain('weapon.bat');
    expect(await state()).toMatchObject({ marker: 'l2-axe-rack' });
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/start-${entry}.png` });
    // Real input: click the ring in the game camera, then hold E.
    const [x, z] = l2Anchors['l2-axe-rack'];
    const point = await page.evaluate(p => window.__SS__!.input.project(p), { x, y: .4, z });
    await page.mouse.click(point.x, point.y);
    for (let i = 0; i < 80; i++) {
      await page.evaluate(() => window.__SS__!.step(5));
      const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
      if (Math.hypot(p.x - x, p.z - z) <= 1.2) break;
    }
    const p = await page.evaluate(() => window.__SS__!.getState().player!.transform);
    expect(Math.hypot(p.x - x, p.z - z), 'the player can stand in the ring').toBeLessThanOrEqual(1.2);
    expect((await holds(page)).left).not.toContain('weapon.fire-axe');
    await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/ring-${entry}.png` });
    await page.keyboard.down('e');
    for (let i = 0; i < 60 && !(await state()).l2!.axe; i++) await page.evaluate(() => window.__SS__!.step(5));
    await page.keyboard.up('e');
    expect((await state()).l2).toMatchObject({ phase: 'alarm', axe: true });
    const after = await page.evaluate(() => window.__SS__!.getState().player!.weapons!);
    expect(after.selectedSide).toBe('LEFT');
    expect(after.LEFT.rack[0].id).toBe('weapon.fire-axe');
    await page.evaluate(() => window.__SS__!.step(10)); await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/equipped-${entry}.png` });
  });
}
