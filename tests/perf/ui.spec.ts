import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
import { hudStart } from '../e2e/ui-helpers';
test('@E14 @perf HUD reuses pins and reports DOM update cost with 200 threats', async ({ page }) => {
  await hudStart(page);
  const result = await page.evaluate(async () => {
    const api = window.__SS__!, p = api.getState().player!.transform;
    for (let i = 0; i < 200; i++) api.spawn('infected.runner', { x: p.x + Math.cos(i) * (3 + i % 24), z: p.z + Math.sin(i) * (3 + i % 24) });
    const samples: number[] = [];
    const count = document.querySelector('[data-testid=hud]')!.querySelectorAll('*').length;
    for (let i = 0; i < 120; i++) { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); samples.push(api.perf().uiMs); }
    samples.sort((a, b) => a - b);
    return { samples, p95: samples[Math.floor(samples.length * .95)], max: samples.at(-1), perf: api.perf(), domCountBefore: count, domCountAfter: document.querySelector('[data-testid=hud]')!.querySelectorAll('*').length, pins: document.querySelectorAll('.hud-pin-threat').length };
  });
  expect(result.domCountAfter).toBe(result.domCountBefore); expect(result.pins).toBe(256);
  // E14 declares no standalone time budget. Record software-renderer timing; hard
  // frame/sim budgets belong to E18's real GPU/device gates, never weaken those.
  mkdirSync('test-results/epics/E14', { recursive: true });
  writeFileSync('test-results/epics/E14/ui-perf.json', JSON.stringify(result, null, 2));
});
