import { boot, expect, test } from './fixtures';

test('L2 gameplay prefetch warms the next level in a worker and releases it @E18', async ({ page, context }) => {
  test.setTimeout(120_000);
  await boot(page, '/?test=1&scenelab=1&quality=low&renderer=webgl&audio=muted');
  const urls = new Set<string>(); context.on('request', request => urls.add(request.url()));
  const completed = page.waitForEvent('worker', { predicate: worker => worker.url().includes('prefetch.worker') }).then(worker => worker.waitForEvent('close'));
  await page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L2'); a.pause(); a.missions.begin(); a.cheats.god(true); await a.step(301);
  });
  await completed;
  const requested = [...urls];
  expect(requested.some(url => url.includes('/assets/layouts/D-CORRIDOR.layout.json'))).toBe(true);
  expect(requested.some(url => url.includes('/assets/layouts/D-CORRIDOR.base.glb'))).toBe(true);
  expect(requested.some(url => url.includes('/assets/models/char.courier-female.skin.glb'))).toBe(true);
  expect(page.workers().some(worker => worker.url().includes('prefetch.worker'))).toBe(false);
});
