import { test, expect } from './fixtures';
import { preset } from '../../src/sim/progression/Campaign';

/**
 * Lane telemetry-gap (PO 10-13: L3/L4 played on PROD never showed up in the funnel). Every way into a level (level select,
 * campaign handover, Continue, restart) must produce a level_start row, completing a level a level_complete row, in a real D1
 * behind a local `wrangler pages dev` (docs/tools/telemetry.md):
 *   E2E_TELEMETRY_BASE=http://127.0.0.1:8791 E2E_TELEMETRY_TOKEN=<token of that server> npx playwright test tests/e2e/telemetry-gap.spec.ts
 * Skipped without a server. The page sends with `?telemetry=live` and `debug=true` (the PO's URL: the build/tick panel needs it).
 */
const base = process.env.E2E_TELEMETRY_BASE, token = process.env.E2E_TELEMETRY_TOKEN;
test.skip(!base || !token, 'needs E2E_TELEMETRY_BASE and E2E_TELEMETRY_TOKEN (local wrangler pages dev)');
test.use({ headless: true });

type Funnel = Record<string, { starts: number; completes: number; restarts: number }>;
const funnel = async (): Promise<Funnel> => {
  const stats = await (await fetch(`${base}/api/stats?days=2&token=${token}`)).json() as { level_funnel: { level: string; starts: number; completes: number; restarts: number }[] };
  return Object.fromEntries(stats.level_funnel.map(f => [f.level, f]));
};
const delta = (after: Funnel, before: Funnel, level: string, key: 'starts' | 'completes' | 'restarts'): number => (after[level]?.[key] ?? 0) - (before[level]?.[key] ?? 0);

test('T-TELEMETRY-5 level select, campaign handover (L3 -> L4 -> L5), Continue and restart each reach D1 as level_start / level_complete rows', async ({ page }) => {
  test.setTimeout(420_000); page.setDefaultTimeout(90_000);
  const before = await funnel();
  await page.goto(`${base}/?test=1&debug=true&ui=1&telemetry=live&renderer=webgl&dpr=1&quality=low&audio=muted&seed=1`);
  await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { await window.__SS__!.ready; window.__SS__!.pause(); });
  const inScenario = (id: string) => page.waitForFunction(id => window.__SS__!.getState().scenario === id && window.__SS__!.missions.state()?.phase === 'briefing', id, { timeout: 150_000 });
  const finishLevel = async (): Promise<void> => {
    await page.evaluate(() => { const a = window.__SS__!; a.pause(); a.missions.begin(); a.cheats.god(true); });
    for (let i = 0; i < 80; i++) {
      if (await page.evaluate(() => window.__SS__!.missions.state()!.phase) !== 'playing') return;
      await page.evaluate(async () => { const a = window.__SS__!; try { a.cheats.completeObjective(); } catch { /* next step not active yet */ } await a.step(30); });
    }
    throw new Error('level did not finish');
  };

  // 1. Level select (a save that unlocked L3) -> L3; finishing L3 hands over to L4 by itself, finishing L4 to L5 (the handover with a setup hook).
  await page.evaluate(save => { const a = window.__SS__!; a.campaign.restore(save); a.campaign.save(); a.campaign.menu(); }, preset('L3-default'));
  await page.getByTestId('start-game').click();
  await page.getByTestId('level-L3').click();
  await inScenario('L3'); await finishLevel();
  await inScenario('L4'); await finishLevel();
  await inScenario('L5');
  // 2. Continue from the menu (unlocked level = L5), then restart that level from the pause menu.
  // The tick counter proves each reload really happened (a reloaded world starts at tick 0, so run the old one forward first).
  const reloaded = () => page.waitForFunction(() => window.__SS__!.getState().tick < 20 && window.__SS__!.getState().scenario === 'L5' && window.__SS__!.missions.state()?.phase === 'briefing', undefined, { timeout: 150_000 });
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.missions.begin(); await a.step(60); a.campaign.menu(); });
  expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBeGreaterThan(40);
  await page.getByTestId('start-game').click();
  await page.getByTestId('level-L5').click();
  await reloaded();
  await page.evaluate(async () => { const a = window.__SS__!; a.pause(); a.missions.begin(); await a.step(60); });
  expect(await page.evaluate(() => window.__SS__!.getState().tick)).toBeGreaterThan(40);
  await page.evaluate(() => { document.querySelector<HTMLElement>('[data-testid=pause-restart]')!.click(); });
  await page.evaluate(() => { document.querySelector<HTMLElement>('[data-testid=restart-confirm-yes]')!.click(); });
  await reloaded();
  // The final flush on page close sends what the 30 s beat has not.
  await page.waitForTimeout(1500);
  await page.close({ runBeforeUnload: true });
  await new Promise(resolve => setTimeout(resolve, 3000));
  const after = await funnel();
  const got = Object.fromEntries(['L3', 'L4', 'L5'].map(l => [l, { starts: delta(after, before, l, 'starts'), completes: delta(after, before, l, 'completes'), restarts: delta(after, before, l, 'restarts') }]));
  console.log('funnel delta', JSON.stringify(got));
  expect(got.L3).toEqual({ starts: 1, completes: 1, restarts: 0 });   // level select
  expect(got.L4).toEqual({ starts: 1, completes: 1, restarts: 0 });   // handover L3 -> L4
  expect(got.L5.starts).toBe(3);                                      // handover L4 -> L5, Continue, restart
  expect(got.L5.restarts).toBe(1);
});
