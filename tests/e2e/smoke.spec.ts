import { mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { canvasFrame, canvasFrameChecks } from './canvas-frame';
import { boot, expect, test, testUrl } from './fixtures';

// Minimal browser smoke (docs/qa/test-strategy.md): boot, the real menu → L1 start, figures actually drawn on both
// backends, no console/pipeline errors (the fixtures' error guard fails any test on console errors and failed requests).
// The GPU-limit program gate lives next to it in crowd-gpu-limits.spec.ts. Everything else is Scene Lab, the nightly
// campaign and the Opus visual QA.

const pipelineFailure = /pipeline creation failed|Tint IR|MTLFunction/i;
async function webgpuAdapter(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/');
  return page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
}

test('boot: ready resolves, the canvas shows spatial detail, and three scenario reloads leave no entities or bodies @smoke', async ({ page }, testInfo) => {
  await boot(page);
  await page.evaluate(async () => { await window.__SS__!.step(60); await window.__SS__!.screenshotReady(); });
  await expect(page).toHaveTitle('Minor Incident');
  expect(canvasFrameChecks(await canvasFrame(page)).filter(c => !c.pass), 'Game canvas contains visible spatial detail').toEqual([]);
  expect(await page.evaluate(() => window.__SS__!.getState().perf)).toMatchObject({ entities: 1, bodies: 2 });
  mkdirSync('test-results/smoke', { recursive: true });
  await page.screenshot({ path: `test-results/smoke/boot-${testInfo.project.name}.png` });
  const resources = await page.evaluate(async () => {
    const api = window.__SS__!;
    for (let i = 0; i < 3; i++) { await api.loadScenario('empty'); api.pause(); await api.step(60); await api.unloadScenario(); }
    return api.getState().perf;
  });
  expect(resources).toEqual({ entities: 0, bodies: 0, colliders: 0, listeners: 0 });
});

// P0 guard (PROD "all other players are invisible"): each on-screen pedestrian's head/torso pixels must change when that
// pedestrian is moved off screen, so hand props and shadows alone cannot pass.
test.describe('L1 start draws its pedestrians', () => {
  test.use({ launchOptions: { args: process.platform === 'darwin'
    ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-webgpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
  for (const renderer of ['webgl', 'webgpu'] as const) test(`L1 pedestrians are drawn on screen (${renderer}), not only their props @smoke`, async ({ page }) => {
    test.setTimeout(120_000);
    if (renderer === 'webgpu') test.skip(!(await webgpuAdapter(page)) && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
    await boot(page, testUrl.replace('renderer=webgl', `renderer=${renderer}`));
    const before = await page.evaluate(async () => {
      const a = window.__SS__!;
      await a.loadLevel('L1', { seed: 1 }); a.missions.begin(); a.pause(); a.camera.follow();
      const player = a.query({ kind: 'player' })[0].transform;
      const calm = () => a.query({ kind: 'civilian' }).filter(e => !e.hidden && !e.civilian?.pet && e.civilian?.adult !== false && e.civilian?.state === 'calm' && e.health.current > 0);
      for (const [i, c] of calm().slice(0, 6).entries()) a.teleport(c.id, { x: player.x - 4 + (i % 3) * 3, z: player.z + 3 + Math.floor(i / 3) * 3 });
      await a.step(30); await a.screenshotReady();
      const civilians = calm().map(e => ({ id: e.id, head: a.camera.project(e.transform.x, e.transform.y + .95, e.transform.z), chest: a.camera.project(e.transform.x, e.transform.y + .45, e.transform.z) }))
        .filter(c => Math.abs(c.head[0]) < .85 && Math.abs(c.head[1]) < .85 && Math.abs(c.chest[1]) < .7 && c.head[2] < 1);
      return { civilians, backend: a.perf().backend };
    });
    const shown = PNG.sync.read(await page.locator('canvas').screenshot());
    await page.evaluate(async ids => { const a = window.__SS__!; ids.forEach((id, i) => a.teleport(id, { x: -400 - i * 3, z: -400 })); await a.step(2); await a.screenshotReady(); }, before.civilians.map(c => c.id));
    const hidden = PNG.sync.read(await page.locator('canvas').screenshot());
    const drawn = before.civilians.filter(c => {
      const cx = Math.round((c.head[0] + 1) / 2 * shown.width), top = Math.round((1 - c.head[1]) / 2 * shown.height);
      const bottom = Math.round((1 - c.chest[1]) / 2 * shown.height), half = Math.max(3, Math.round((bottom - top) / 4));
      let changed = 0;
      for (let y = Math.max(0, top); y < Math.min(shown.height, bottom); y++) for (let x = Math.max(0, cx - half); x < Math.min(shown.width, cx + half); x++) {
        const i = (y * shown.width + x) * 4;
        if (Math.abs(shown.data[i] - hidden.data[i]) + Math.abs(shown.data[i + 1] - hidden.data[i + 1]) + Math.abs(shown.data[i + 2] - hidden.data[i + 2]) > 24) changed++;
      }
      return changed >= (bottom - top) * half * 2 * .25;
    }).length;
    expect(before.backend).toBe(renderer);
    expect(before.civilians.length, 'pedestrians in the L1 start view').toBeGreaterThanOrEqual(3);
    expect(drawn, 'pedestrian heads/torsos actually rendered').toBe(before.civilians.length);
  });
});

// Hotfix 16: a textured crowd shader failed WebGPU pipeline creation only WITHOUT --enable-unsafe-webgpu (players' Chrome),
// so the near suit zombies were invisible while still attacking. Real player flow: menu → character → L1 → mission.
test.describe('menu to L1 on unflagged WebGPU', () => {
  test.use({ launchOptions: { args: process.platform === 'darwin'
    ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });
  test('the menu → L1 start compiles every render pipeline with suit zombies drawn (WebGPU, low) @smoke', async ({ page }) => {
    test.setTimeout(180_000);
    test.skip(!(await webgpuAdapter(page)) && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
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
});
