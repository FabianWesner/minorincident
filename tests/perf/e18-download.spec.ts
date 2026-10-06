import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
test('T-E18-03 @E18-AC03 @perf production initial network payload <=15MB gzip through level.started', async ({ page }) => {
  test.setTimeout(180_000);
  const requests: Promise<{ url: string; rawBytes: number; gzipBytes: number }>[] = []; let collecting = true;
  page.on('requestfinished', request => {
    if (!collecting || !request.url().startsWith('http')) return;
    requests.push((async () => { const response = await request.response(); const body = await response!.body(); return { url: new URL(request.url()).pathname, rawBytes: body.length, gzipBytes: gzipSync(body).length }; })());
  });
  await page.goto('/?test=1&renderer=webgl&quality=high&audio=muted');
  await page.waitForFunction(() => Boolean(window.__SS__));
  const event = await page.evaluate(async () => { const a = window.__SS__!; await a.ready; await a.loadLevel('L1'); await a.screenshotReady(); a.missions.begin(); a.pause(); return a.events().find(e => e.type === 'level.started'); });
  collecting = false; expect(event).toMatchObject({ type: 'level.started', id: 'L1' });
  const files = await Promise.all(requests), gzipBytes = files.reduce((n, f) => n + f.gzipBytes, 0);
  expect(files.some(f => f.url.endsWith('.glb'))).toBe(true); expect(files.some(f => /rapier-.*\.js$/.test(f.url))).toBe(true);
  expect(files.some(f => f.url.includes('/src/'))).toBe(false); expect(gzipBytes).toBeLessThanOrEqual(15_000_000);
  mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync('test-results/epics/E18/download.json', JSON.stringify({ frontier: event, measurement: 'gzip of production response bodies observed through Playwright requestfinished; preview serves uncompressed bodies', gzipBytes, rawBytes: files.reduce((n, f) => n + f.rawBytes, 0), files }, null, 2));
});
