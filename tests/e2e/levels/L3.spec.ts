import { expect, test, attachErrorGuard, boot } from '../fixtures';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'test-results/epics/E21';
const policy = process.env.L3_BOT_POLICY === 'newbie' ? 'newbie' : 'complete';
for (const route of ['market', 'park'] as const) test(`@E21 @E21-AC08 @E21-AC09 browser bot via ${route}, driving at timescale 2 and four photo spots`, async ({ page }) => {
  test.setTimeout(600_000); const consoleErrors = attachErrorGuard(page).errors; mkdirSync(output, { recursive: true });
  await boot(page); await page.evaluate(() => window.__SS__!.loadLevel('L3', { seed: 1, progression: 'L3-default' }));
  await page.evaluate(({ route, policy }) => { const api = window.__SS__!; api.pause(); api.missions.begin(); api.setTimeScale(2); api.bot.start(policy, { route }); }, { route, policy } as const);
  const captured = new Set<string>();
  const snap = async (name: string) => {
    await page.evaluate(name => { window.__SS__!.pause(); window.__SS__!.camera.preset(name); }, name); await page.evaluate(() => window.__SS__!.screenshotReady());
    await page.screenshot({ path: `${output}/${name}-${route}.png` }); captured.add(name); await page.evaluate(() => window.__SS__!.camera.follow());
    await page.evaluate(() => window.__SS__!.resume());
  };
  await snap('l3-mainstreet-w2');
  for (let i = 0; i < 3000; i++) {
    const state = await page.evaluate(() => ({ player: window.__SS__!.getState().player, mission: window.__SS__!.missions.state() }));
    if (i % 20 === 0) writeFileSync(`${output}/browser-progress-${route}.json`, JSON.stringify(state, null, 2));
    if (!captured.has('l3-driving') && state.player?.hidden) await snap('l3-driving');
    if (!captured.has('l3-checkpoint') && state.mission?.steps.checkpoint.status === 'active') await snap('l3-checkpoint');
    if (state.mission?.phase === 'cinematic' || state.mission?.phase === 'result') { await snap('l3-safe-zone'); break; }
    // Run the real frame clock at 2x; fixed-step APIs bypass its time scale.
    await page.waitForTimeout(150);
  }
  await expect.poll(() => page.evaluate(() => window.__SS__!.missions.state()?.phase), { timeout: 20_000 }).toBe('result');
  await page.evaluate(() => window.__SS__!.pause());
  const final = await page.evaluate(() => ({ mission: window.__SS__!.missions.state() }));
  writeFileSync(`${output}/browser-${route}.json`, JSON.stringify({ mission: final.mission, entities: await page.evaluate(() => window.__SS__!.getState().entities), events: await page.evaluate(() => window.__SS__!.events().slice(-80)) }, null, 2));
  expect(final.mission?.phase).toBe('result'); expect(final.mission?.states.collapsed).toBe(true);
  expect(final.mission?.counters.runovers).toBeGreaterThanOrEqual(5); expect(final.mission?.counters.smashed).toBeGreaterThanOrEqual(3);
  expect([...captured].sort()).toEqual(['l3-checkpoint', 'l3-driving', 'l3-mainstreet-w2', 'l3-safe-zone']); expect(consoleErrors).toEqual([]);
  // The existing campaign Continue action supplies the handover, with no reward screen.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible();
  expect(await page.evaluate(() => window.__SS__!.getState().scenario)).toBe('L4');
});
