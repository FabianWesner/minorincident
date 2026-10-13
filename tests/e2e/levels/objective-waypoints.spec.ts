import type { Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot, testUrl } from '../fixtures';
import { l3, l3Anchors } from '../../../src/data/l3';

/** PO 2026-10-12: the rescue completes only with the whole following group (police squad and corgi) inside; shortcut setups bring them along. */
const bringGroup = (page: Page, ring: readonly number[]) => page.evaluate(([rx, rz]) => {
  const api = window.__SS__!, ids = [...api.missions.state()!.l3!.officerIds, ...api.query({}).filter(e => e.companion).map(e => e.id)];
  ids.forEach((id, i) => api.teleport(id, { x: rx + 2 + (i % 4) * .8, z: rz - 3 + Math.floor(i / 4) * .8 }));
}, ring);
test('L3 defence waypoint @E21: game camera and explained destinations', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, `${testUrl}&ui=1&debug=true&inspect=1&level=L3`);
  const output = 'test-results/l3-yellow-ring';
  mkdirSync(output, { recursive: true });
  await page.evaluate(async () => {
    const api = window.__SS__!;
    api.inspect.enable(false);
    api.pause();
    api.cheats.god(true);
    api.teleport('player', { x: -141.2, z: -8.4 });
    await api.step(60);
    api.teleport('player', { x: -139.2, z: -8.4 });
    await api.step(1);
    await api.screenshotReady();
  });
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.marker)).toBe('l3-armory');
  await expect(page.getByTestId('objective-text')).toContainText('Hold still or press E');
  await expect(page.getByTestId('objective-text')).toContainText('Take a handgun from the armory');
  await page.screenshot({ path: `${output}/after-armory.png` });
  await page.evaluate(async () => {
    const api = window.__SS__!;
    api.teleport('player', { x: -142, z: 2 });
    api.cheats.completeObjective('armory');
    await api.step(310);
    api.camera.follow();
    await api.step(1);
    await api.screenshotReady();
  });
  const state = await page.evaluate(() => window.__SS__!.missions.state()!);
  expect(state.steps.defend.status).toBe('active');
  expect(state.marker).toBeNull();
  await expect(page.locator('.hud-tracker')).toContainText('Help defend the station');
  await page.screenshot({ path: `${output}/after-defend.png` });
  writeFileSync(`${output}/after-defend.json`, JSON.stringify(state, null, 2));
  const fallbackMarker = await page.evaluate(async () => {
    const api = window.__SS__!;
    api.cheats.completeObjective('defend');
    // The objective names the destination; connected-route guidance follows at its 6 Hz refresh (757eae35), so within 10 ticks.
    const marker = api.missions.state()!.marker;
    await api.step(10);
    await api.screenshotReady();
    return marker;
  });
  expect(fallbackMarker).toBe('l3-zone');
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.marker)).toBe('l3-route');
  await expect(page.locator('.hud-tracker')).toContainText('Reach the rendezvous ring inside the army checkpoint');
  await page.screenshot({ path: `${output}/after-fallback.png` });
  await bringGroup(page, l3Anchors['l3-zone']);
  await page.evaluate(async ([x, z]) => {
    const api = window.__SS__!;
    // Shortcut arrival must finish without walking the route guidance first.
    api.teleport('player', { x, z });
    await api.step(20);
    api.camera.follow();
    await api.screenshotReady();
  }, l3Anchors['l3-zone']);
  // PO 2026-10-12: the transition waits for the 60 s rescue fight and the safe boom closure, no longer for the player alone.
  for (let i = 0; i < 200 && !(await page.evaluate(() => window.__SS__!.missions.state()!.l3!.crossedAt)); i++) await page.evaluate(() => window.__SS__!.step(30));
  const arrived = await page.evaluate(() => window.__SS__!.missions.state()!);
  expect(arrived.l3!.crossedAt).toBeGreaterThan(0);
  expect(arrived.marker).toBeNull();
  await page.screenshot({ path: `${output}/after-arrival.png` });
});

test('L3 real click into the finale finishes while the boom is occupied @E21 @E21-AC17', async ({ page }) => {
  test.setTimeout(240_000);
  const output = 'test-results/l3-yellow-ring';
  mkdirSync(output, { recursive: true });
  await boot(page, `${testUrl}&ui=1&debug=true`);
  await page.evaluate(() => window.__SS__!.loadLevel('L3', { seed: 1, progression: 'L3-default' }));
  await page.getByRole('button', { name: 'Begin mission' }).click();
  await page.evaluate(() => window.__SS__!.pause());
  const blockerId = await page.evaluate(async ({ barrierX, ring }) => {
    const api = window.__SS__!;
    api.inspect.enable(false); api.pause(); api.cheats.god(true);
    api.cheats.completeObjective('armory');
    await api.step(310);
    api.cheats.completeObjective('defend');
    const id = api.npcs.civilian('resident', { x: barrierX, z: 0 }, { waypoints: [{ x: barrierX, z: 0 }] });
    api.teleport('player', { x: ring[0] - 4, z: ring[1] });
    await api.step(60);
    api.camera.follow(); await api.screenshotReady();
    return id;
  }, { barrierX: l3.finale.barrierX, ring: l3Anchors['l3-zone'] });
  await bringGroup(page, l3Anchors['l3-zone']);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.l3!.crossedAt)).toBe(0);
  await expect(page.locator('.hud-tracker')).toContainText('Reach the rendezvous ring inside the army checkpoint');
  await page.screenshot({ path: `${output}/after-compound-rendezvous.png` });
  const click = await page.evaluate(([x, z]) => window.__SS__!.input.project({ x, z }), l3Anchors['l3-zone']);
  await page.mouse.click(click.x, click.y);
  // PO 2026-10-12 ("army rescues us"): the rescue fight lasts minFightS (60 s) and the transition waits for the safe boom closure,
  // superseding the player-only closure of 10-11. A stray civilian in the arm's path must still not hold it open.
  let arrived = false;
  for (let i = 0; i < 200; i++) {
    await page.evaluate(() => window.__SS__!.step(30));
    const state = await page.evaluate(() => window.__SS__!.missions.state());
    if (state?.l3?.crossedAt) { arrived = true; break; }
  }
  expect(arrived).toBe(true);
  const state = await page.evaluate(() => window.__SS__!.missions.state()!);
  expect(state.l3!.barrierClosedAt ?? 0).toBeGreaterThan(0);
  const blocker = await page.evaluate(id => window.__SS__!.getEntity(id)!, blockerId);
  expect(blocker.health.current).toBeGreaterThan(0);
  expect(blocker.transform.x).toBeGreaterThan(l3.finale.barrierX + 1);
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/after-finale-entry.png` });
  await page.evaluate(() => window.__SS__!.step(90));
  await page.waitForFunction(() => window.__SS__!.getState().scenario === 'L4', undefined, { timeout: 120_000 });
  await expect(page.getByRole('heading', { name: 'Mission briefing' })).toBeVisible();
  await page.evaluate(() => window.__SS__!.screenshotReady());
  await page.screenshot({ path: `${output}/after-finale-L4.png` });
});

test('L3 inspection tracker updates when defence has no marker @E21', async ({ page }) => {
  test.setTimeout(180_000);
  await boot(page, `${testUrl}&debug=true&inspect=1&level=L3`);
  await page.evaluate(async () => {
    const api = window.__SS__!;
    api.cheats.completeObjective('armory');
    await api.step(310);
  });
  await expect(page.getByTestId('mission-tracker')).toHaveText('Help defend the station');
  await expect(page.getByTestId('mission-marker')).toBeHidden();
  await expect(page.getByTestId('mission-pin-armory')).toBeHidden();
  await expect(page.getByTestId('mission-pin-defend')).toBeHidden();
});
