import { expect, test } from './fixtures';

// Hotfix 16: a textured crowd shader failed WebGPU pipeline creation only WITHOUT --enable-unsafe-webgpu (players' Chrome),
// so the near suit zombies were invisible while still attacking. The real player flow: menu → character → L1 → mission.
// No --enable-unsafe-webgpu on macOS on purpose: with it, Dawn compiled the broken shader fine.
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

const pipelineFailure = /pipeline creation failed|Tint IR|MTLFunction/i;

test('menu → L1 start on unflagged WebGPU compiles every render pipeline with suit zombies drawn (low tier) @smoke', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
  test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
  const failures: string[] = [];
  page.on('console', m => { if (m.type() === 'error' && pipelineFailure.test(m.text())) failures.push(m.text()); });
  await page.goto('/?quality=low&testApi=1&dpr=1&audio=muted');
  await page.getByTestId('start-game').click({ timeout: 120_000 });
  await page.waitForTimeout(500);
  if (await page.getByTestId('character-female').isVisible().catch(() => false)) await page.getByTestId('character-female').click();
  await page.getByTestId('level-L1').click({ timeout: 60_000 });
  await page.getByTestId('mission-button').click({ timeout: 120_000 });
  const result = await page.evaluate(async () => {
    const a = window.__SS__!; a.cheats.god(true); a.pause();
    const me = a.getEntity(1)!.transform;
    for (let i = 0; i < 6; i++) a.spawn('infected.runner', { x: me.x + 1.5 + (i % 3) * 1.4, z: me.z + 1 + Math.floor(i / 3) * 1.6 });
    for (let k = 0; k < 30; k++) { await a.step(1); await new Promise(requestAnimationFrame); }
    const crowd = a.getState().render.crowd!;
    return { backend: a.perf().backend, atlasInstances: crowd.batches.filter(b => b.atlas).reduce((n, b) => n + b.instances, 0) };
  });
  await page.waitForTimeout(1500); // async pipeline creation reports after the compile settles
  expect(result.backend).toBe('webgpu');
  expect(result.atlasInstances, 'textured suit-zombie instances in view').toBeGreaterThan(0);
  expect(failures, 'WebGPU render pipeline creation errors').toEqual([]);
});
