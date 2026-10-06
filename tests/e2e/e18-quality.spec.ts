import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, test, expect } from './fixtures';
const output = 'test-results/epics/E18';
test('T-E18-04-browser @E18-AC04 auto drops high to low within 6s and only upgrades at level start', async ({ page }) => {
  await boot(page);
  await page.evaluate(async () => window.__SS__!.loadScenario('combat-arena'));
  await page.getByLabel('Graphics quality').selectOption('auto');
  await page.evaluate(() => { const a = window.__SS__!; a.debug.simulateFrameCost(30); a.resume(); });
  const start = Date.now();
  await expect.poll(() => page.evaluate(() => window.__SS__!.perf().quality.tier), { timeout: 6000, intervals: [100] }).toBe('low');
  const dropMs = Date.now() - start;
  const low = await page.evaluate(() => ({ audio: window.__SS__!.audio.snapshot().voiceLimit, render: window.__SS__!.getState().render }));
  expect(low.audio).toBe(16); expect(low.render.pixelRatio).toBeLessThanOrEqual(1.5); expect(low.render.lighting!.shadowSize).toBe(1024); expect(low.render.vfx!.gibCap).toBe(30);
  await page.evaluate(() => window.__SS__!.debug.simulateFrameCost(0));
  await page.waitForTimeout(1100); expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe('low');
  const after = await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('survivor'); a.pause(); return { quality: a.perf().quality, voiceLimit: a.audio.snapshot().voiceLimit }; });
  expect(after.quality.tier).toBe('high'); expect(after.voiceLimit).toBe(32);
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/adaptive.json`, JSON.stringify({ dropMs, ...after }, null, 2));
});
test('T-E18-06 @E18-AC06 real WEBGL_lose_context restores draws in 3s while simulation remains paused', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { const a = window.__SS__!; await a.loadScenario('survivor'); a.resume(); await a.screenshotReady(); });
  const before = await page.evaluate(async () => {
    const canvas = document.querySelector('canvas')!;
    const extension = canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('WEBGL_lose_context unavailable');
    (window as unknown as { loss: WEBGL_lose_context }).loss = extension;
    await new Promise<void>(resolve => { canvas.addEventListener('webglcontextlost', () => resolve(), { once: true }); extension.loseContext(); });
    return window.__SS__!.tick();
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__SS__!.tick())).toBe(before);
  const frames = await page.evaluate(() => window.__SS__!.perf().renderedFrames);
  const start = Date.now(); await page.evaluate(() => (window as unknown as { loss: WEBGL_lose_context }).loss.restoreContext());
  await expect.poll(() => page.evaluate(() => window.__SS__!.perf().renderedFrames), { timeout: 3000, intervals: [50] }).toBeGreaterThan(frames);
  const proof = await page.evaluate(() => ({ perf: window.__SS__!.perf(), tick: window.__SS__!.tick(), navigations: performance.getEntriesByType('navigation').length }));
  expect(proof.tick).toBe(before); expect(proof.perf.contextLost).toBe(false); expect(proof.perf.paused).toBe(true); expect(proof.perf.drawCalls).toBeGreaterThan(0); expect(proof.navigations).toBe(1);
  mkdirSync(output, { recursive: true }); writeFileSync(`${output}/context.json`, JSON.stringify({ restoreMs: Date.now() - start, ...proof }, null, 2));
  await page.locator('canvas').screenshot({ path: `${output}/context-restored.png` });
  await page.evaluate(async () => { const a = window.__SS__!; await a.step(1); a.resume(); });
  await expect.poll(() => page.evaluate(() => window.__SS__!.tick())).toBeGreaterThan(before + 1);
});
test('T-E18-visibility @E18-AC07 background pauses and releases held input', async ({ page }) => {
  await boot(page); await page.evaluate(async () => { await window.__SS__!.loadScenario('survivor'); window.__SS__!.resume(); });
  await page.keyboard.down('w');
  const tick = await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); return window.__SS__!.tick(); });
  await page.waitForTimeout(200); expect(await page.evaluate(() => window.__SS__!.tick())).toBe(tick); expect(await page.evaluate(() => window.__SS__!.perf().paused)).toBe(true);
  await page.evaluate(() => { delete (document as unknown as { hidden?: boolean }).hidden; document.dispatchEvent(new Event('visibilitychange')); });
  await page.keyboard.up('w');
});

test('E18 @E18 perf overlay uses real counters and teardown leaves no scenario resources', async ({ page }) => {
  await page.goto('/?test=1&renderer=webgl&perf&quality=low&audio=muted'); await page.waitForFunction(() => Boolean(window.__SS__));
  await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadScenario('perf-horde-100'); a.resume(); });
  await expect(page.locator('[data-perf-overlay]')).toContainText('low (low) / webgl');
  await expect(page.locator('[data-perf-overlay]')).toContainText('101 entities');
  await page.evaluate(async () => { await window.__SS__!.unloadScenario(); window.__SS__!.pause(); await window.__SS__!.screenshotReady(); });
  expect(await page.evaluate(() => window.__SS__!.getState().perf)).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
});
