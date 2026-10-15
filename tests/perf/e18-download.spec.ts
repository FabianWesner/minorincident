import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '../e2e/fixtures';
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

for (const variant of ['female', 'male'] as const) for (const quality of ['high', 'low'] as const) for (const renderer of ['webgl', 'webgpu'] as const)
test(`T-E18-03 @E18-AC03 @perf production initial network payload <=15MB through Begin (${variant}, ${quality}, ${renderer})`, async ({ page, context }) => {
  test.setTimeout(180_000);
  const requests: Promise<{ url: string; bodyBytes: number }>[] = []; let collecting = true;
  context.on('requestfinished', request => {
    if (!collecting || !request.url().startsWith('http')) return;
    requests.push((async () => ({ url: new URL(request.url()).pathname, bodyBytes: (await request.sizes()).responseBodySize }))());
  });
  // Use the shipped title/character/level flow: test=1 boots an empty world and
  // skips speculative loading, hiding genuine startup traffic from this budget.
  await page.goto(`/?testApi=1&renderer=${renderer}&quality=${quality}`);
  await page.getByTestId('start-game').click();
  await page.getByTestId(`character-${variant}`).click();
  await page.getByTestId('level-L1').click();
  await expect(page.getByTestId('mission-button')).toBeVisible({ timeout: 120_000 });
  await page.evaluate(() => window.__SS__!.screenshotReady());
  collecting = false;
  await page.getByTestId('mission-button').click();
  const event = await page.evaluate(() => { const a = window.__SS__!; a.pause(); return a.events().find(e => e.type === 'level.started'); });
  expect(event).toMatchObject({ type: 'level.started', id: 'L1' });
  expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(renderer);
  const files = await Promise.all(requests), bodyBytes = files.reduce((n, f) => n + f.bodyBytes, 0);
  mkdirSync('test-results/epics/E18', { recursive: true }); writeFileSync(`test-results/epics/E18/download-${variant}-${quality}-${renderer}.json`, JSON.stringify({ variant, quality, renderer, frontier: event, measurement: 'browser-context requestfinished including dedicated workers; encoded HTTP responseBodySize before level.started', bodyBytes, files }, null, 2));
  expect(files.some(f => f.url.endsWith('.glb'))).toBe(true); expect(files.some(f => /rapier-.*\.js$/.test(f.url))).toBe(true);
  expect(files.some(f => f.url.includes('/src/'))).toBe(false);
  expect(bodyBytes, 'worker-inclusive response body bytes').toBeLessThanOrEqual(15_000_000);
});
