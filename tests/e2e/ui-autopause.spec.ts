import { expect, test } from './fixtures';
import { menuStart, hudStart, menuUrl } from './ui-helpers';
import { missionSandbox } from '../fixtures/scenarios/mission-sandbox';
for (const kind of ['blur', 'hidden', 'pagehide'] as const) test(`T-E14-11-${kind} @E14 @E14-AC11 ${kind} shows pause synchronously and returning requires Resume`, async ({ page }) => {
  await menuStart(page);
  const before = await page.evaluate(kind => {
    const start = performance.now();
    if (kind === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); }
    else window.dispatchEvent(new Event(kind));
    return { tick: window.__SS__!.tick(), elapsed: performance.now() - start, pauseVisible: !document.querySelector<HTMLElement>('[data-testid=menu-pause]')!.hidden };
  }, kind);
  expect(before.elapsed).toBeLessThan(100); expect(before.pauseVisible).toBe(true);
  await page.waitForTimeout(200); expect(await page.evaluate(() => window.__SS__!.tick())).toBe(before.tick);
  await page.evaluate(kind => {
    if (kind === 'hidden') { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); }
    else if (kind === 'pagehide') window.dispatchEvent(new Event('pageshow'));
    window.dispatchEvent(new Event('focus'));
  }, kind);
  await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().background)).toBe(false);
  await page.waitForTimeout(100); expect(await page.evaluate(() => window.__SS__!.tick())).toBe(before.tick);
  await expect(page.getByTestId('menu-pause')).toBeVisible(); await page.getByTestId('resume-game').click();
  await expect.poll(() => page.evaluate(() => window.__SS__!.tick())).toBeGreaterThan(before.tick);
});
test('T-E14-11-cinematic @E14 @E14-AC11 cinematic frame stays constant while away and continues after Resume', async ({ page }) => {
  await hudStart(page);
  const def = missionSandbox(); def.onComplete = [{ kind: 'cinematic', id: 'twist' }]; def.cinematics.twist.seconds = 20;
  await page.evaluate(async def => { const api = window.__SS__!; api.missions.load(def); api.missions.begin(); api.cheats.completeObjective(); await api.step(40); api.resume(); }, def);
  const elapsed = await page.evaluate(() => { window.dispatchEvent(new Event('blur')); return window.__SS__!.missions.state()!.cinematic!.elapsed; });
  await expect(page.getByTestId('menu-pause')).toBeVisible(); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.cinematic!.elapsed)).toBe(elapsed);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect.poll(() => page.evaluate(() => window.__SS__!.audio.snapshot().background)).toBe(false);
  expect(await page.evaluate(() => window.__SS__!.missions.state()!.cinematic!.elapsed)).toBe(elapsed);
  await page.getByTestId('resume-game').click();
  await expect.poll(() => page.evaluate(() => window.__SS__!.missions.state()!.cinematic!.elapsed)).toBeGreaterThan(elapsed);
});
test('@E14 menu backgrounding keeps title and character selection intact', async ({ page }) => {
  await page.goto(menuUrl); await expect(page.getByTestId('menu-title')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(page.getByTestId('menu-title')).toBeVisible(); await expect(page.getByTestId('menu-pause')).toBeHidden();
});
