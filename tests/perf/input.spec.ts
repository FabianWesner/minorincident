import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../e2e/fixtures';

test('T-E03-perf @E03 @perf device input preserves renderer counters and reports fixed-tick cost', async ({ page }) => {
  await boot(page);
  const cursor = await page.evaluate(() => window.__SS__!.input.project({ x: 0.5, z: 0 }));
  await page.mouse.move(cursor.x, cursor.y); await page.keyboard.down('j');
  const measured = await page.evaluate(async () => {
    const api = window.__SS__!;
    await api.step(60); // warm-up
    const start = performance.now(); await api.step(600); const elapsedMs = performance.now() - start;
    return { ticks: 600, elapsedMs, meanTickMsIncludingFinalRender: elapsedMs / 600, perf: api.perf() };
  });
  expect(measured.perf.entities).toBe(1); expect(measured.perf.geometries).toBe(3);
  expect(measured.perf.drawCalls).toBe(3); expect(measured.perf.triangles).toBe(15);
  mkdirSync('test-results/epics/E03', { recursive: true });
  writeFileSync('test-results/epics/E03/perf.json', JSON.stringify(measured, null, 2) + '\n');
});
