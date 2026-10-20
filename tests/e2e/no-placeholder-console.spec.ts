import { boot, expect, test, testUrl } from './fixtures';

// PO bug #43 (Opus visual QA 10-19): "[assets] ability.corgi-lure fell back to a PLACEHOLDER BOX (missing lod0). Never ship this."
// No level may log a placeholder fallback, fresh save or progressed save.
const levels: [string, string | undefined][] = [['L1', undefined], ['L2', 'L2-default'], ['L3', 'L3-default'], ['L4', 'L4-default'], ['L5', 'L5-default'], ['L6', 'L6-default'], ['L7', 'L7-default'], ['L8', 'L8-default'], ['L9', 'L8-default'], ['L10', 'L10-default']];
test('@E17 no level load logs an asset PLACEHOLDER fallback (fresh and progressed saves)', async ({ page }) => {
  test.setTimeout(240_000);
  const placeholders: string[] = [];
  page.on('console', message => { if (/PLACEHOLDER|asset\.placeholder/i.test(message.text())) placeholders.push(message.text()); });
  await boot(page, testUrl);
  for (const [level, progression] of levels) for (const fresh of [true, false]) {
    if (fresh !== !progression) continue; // L1 runs the fresh save, every later level its progressed preset (a fresh save cannot load them)
    await page.evaluate(async ({ level, progression }) => { const a = window.__SS__!; await a.loadLevel(level, { seed: 1, ...(progression ? { progression: progression as never } : {}) }); a.pause(); await a.step(60); await a.screenshotReady(); }, { level, progression: fresh ? undefined : progression });
  }
  expect(placeholders).toEqual([]);
});
