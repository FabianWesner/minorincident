import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';

const output = 'test-results/l5-encounters/ending';
for (const quality of ['high', 'low'] as const) test(`T-E23-E1 @E23 @E23-AC15 visible physical ingress, closure and 24 persistent occupants, ${quality}`, async ({ page }) => {
  test.setTimeout(180_000); mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl.replace('quality=high', `quality=${quality}`)}&ui=1`);
  await page.evaluate(async () => {
    const a = window.__SS__!;
    await a.loadLevel('L5', { seed: 7, progression: 'L5-default' }); a.pause(); a.missions.begin();
    a.cheats.killAll(); a.cheats.completeObjective('emerge'); await a.step(660); a.cheats.completeObjective('look');
    const s = a.missions.state()!.l5!;
    a.teleport(1, { x: 38.1854, z: -44 });
    s.survivors.forEach((r, i) => a.teleport(r.id, { x: 37.7854 + (i % 2 ? .4 : -.4), z: -42 + Math.floor(i / 2) * .8 }));
    a.camera.follow(); await a.step(90); await a.screenshotReady();
  });
  const racks = await page.evaluate(() => { const w = window.__SS__!.getState().player!.weapons!; return { LEFT: w.LEFT.rack.map(r => r.id), RIGHT: w.RIGHT.rack.map(r => r.id) }; });
  const before = await page.evaluate(() => window.__SS__!.missions.state()!.l5!);
  expect(before.stationIds).toHaveLength(24);
  await page.locator('canvas').screenshot({ path: `${output}/before-${quality}.png` });
  await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W5/l5-metro-shelter'); await a.screenshotReady(); });
  await page.locator('canvas').screenshot({ path: `${output}/occupants-before-${quality}.png` });
  await page.evaluate(() => window.__SS__!.camera.follow());
  await page.evaluate(() => window.__SS__!.input.set({ moveTarget: { x: 38.1854, z: -50.6 }, walk: true }));
  let shutter = 0, arrivalCaptured = false;
  for (let i = 0; i < 120 && !shutter; i++) {
    const state = await page.evaluate(async () => { const a = window.__SS__!; await a.step(10); return a.missions.state()!.l5!; });
    shutter = state.shutterAt;
    if (state.metroAt && !shutter && !arrivalCaptured) {
      await page.evaluate(() => window.__SS__!.screenshotReady());
      await page.locator('canvas').screenshot({ path: `${output}/arrival-${quality}.png` }); arrivalCaptured = true;
    }
  }
  expect(arrivalCaptured).toBe(true);
  expect(shutter).toBeGreaterThan(0);
  const atClosure = await page.evaluate(() => {
    const a = window.__SS__!, s = a.missions.state()!.l5!;
    return s.survivors.map(r => ({ status: r.status, at: a.getState().entities.find(e => e.id === r.id)!.transform }));
  });
  expect(atClosure.every(r => r.status === 'sheltered' && r.at.z < -47.78 && Math.abs(r.at.x - 37.7854) <= 1)).toBe(true);
  await page.evaluate(async shutter => { const a = window.__SS__!; await a.step(Math.max(0, shutter + 120 - a.getState().tick)); await a.screenshotReady(); }, shutter);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.gates['l5-metro-shutter'])).toBe(false);
  await page.locator('canvas').screenshot({ path: `${output}/after-${quality}.png` });
  await page.evaluate(async () => { const a = window.__SS__!; a.camera.preset('D-FAIR/W5/l5-metro-shelter'); await a.screenshotReady(); });
  await page.locator('canvas').screenshot({ path: `${output}/occupants-${quality}.png` });
  await page.evaluate(() => window.__SS__!.step(60));
  await expect.poll(() => page.evaluate(() => window.__SS__!.getState().scenario), { timeout: 120_000 }).toBe('L6');
  const handover = await page.evaluate(() => ({ campaign: window.__SS__!.campaign.state(), mission: window.__SS__!.missions.state() }));
  expect(handover.campaign!.racks).toEqual(racks);
  expect(handover.campaign!.stationOccupants!.map(e => e.id)).toEqual(before.stationIds);
  expect(handover.campaign!.rescuedSurvivors!.map(e => e.id)).toEqual(before.survivors.map(r => r.id));
  expect(handover.mission!.l6!.survivors.filter(r => before.survivors.some(prior => prior.id === r.id))).toHaveLength(5);
  expect(handover.mission!.l6!.survivors.filter(r => before.stationIds.includes(r.id))).toHaveLength(24);
  writeFileSync(`${output}/${quality}.json`, JSON.stringify({ before, atClosure, handover }, null, 2));
});
