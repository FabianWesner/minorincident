import { readSpec } from '../../tools/scenelab/session';
import { boot, expect, test, testUrl } from './fixtures';

// Hotfix 16 (PROD batch 16): the textured suit-zombie crowd material read texel.r off
// sampleTexture(...).rgb; TSL emitted `nodeVar.xyz.x` and Dawn's Tint/Metal backend failed with
// "swizzle view instruction still has usages after lowering". three marks such a pipeline as
// failed and skips its draws for the session, so the near-LOD suit zombies were invisible on
// WebGPU while the sim kept them attacking. WebGL2 was unaffected. Guard: no render-pipeline
// creation failure on WebGPU at the L1 start (real menu flow, suit zombies spawned in view) and in
// the textured crowd/corpse scenes, high and low.
// No --enable-unsafe-webgpu on macOS: players' Chrome runs without it, and with it Dawn compiles
// the broken shader fine (Scene Lab and the other WebGPU specs pass that flag and missed this; this
// spec failed 4/4 on the broken build without it).
test.use({ launchOptions: { args: process.platform === 'darwin'
  ? ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu']
  : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] } });

const pipelineFailure = /pipeline creation failed|Tint IR|MTLFunction/i;

async function requireWebgpu(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  const adapter = await page.evaluate(async () => Boolean(await (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu?.requestAdapter()));
  test.skip(!adapter && process.platform !== 'darwin', 'No WebGPU adapter in this headless browser');
}

for (const tier of ['low', 'high'] as const) {
  test(`T-E02-webgpu-pipelines-l1 @smoke @E02 WebGPU ${tier}: the menu → L1 start compiles every render pipeline (suit zombies drawn)`, async ({ page }) => {
    test.setTimeout(180_000);
    await requireWebgpu(page);
    const failures: string[] = [];
    page.on('console', m => { if (m.type() === 'error' && pipelineFailure.test(m.text())) failures.push(m.text()); });
    // The real player flow (no test=1): the failing variant only came from the menu start's prewarm.
    await page.goto(`/?quality=${tier}&testApi=1&dpr=1&audio=muted`);
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
    // Async pipeline creation reports after the compile settles.
    await page.waitForTimeout(1500);
    expect(result.backend).toBe('webgpu');
    expect(result.atlasInstances, 'textured suit-zombie instances in view').toBeGreaterThan(0);
    expect(failures, 'WebGPU render pipeline creation errors').toEqual([]);
  });

  test(`T-E02-webgpu-pipelines-scene @smoke @E02 WebGPU ${tier}: textured crowd and frozen corpse pages compile`, async ({ page }) => {
    test.setTimeout(180_000);
    await requireWebgpu(page);
    const failures: string[] = [];
    page.on('console', m => { if (m.type() === 'error' && pipelineFailure.test(m.text())) failures.push(m.text()); });
    await boot(page, `${testUrl.replace('renderer=webgl', 'renderer=webgpu').replace('quality=high', `quality=${tier}`)}&scenelab=1`);
    const horde = readSpec('specs/scenes/catalog/inf-horde-headwear.json');
    const result = await page.evaluate(async (horde) => {
      const lab = window.__SCENE__!, a = window.__SS__!;
      await lab.load({ name: 'webgpu-pipelines-suits', ground: 'asphalt', time: 'L1', dof: false, camera: { mode: 'game', target: [0, .8, 0], zoom: 1.5 },
        actors: [0, 1, 2].map(i => ({ id: `suit${i}`, kind: 'infected', archetype: 'infected.runner', at: [i * 1.2 - 1.2, 0], look: { model: 'inf.common-worker' }, state: 'idle' })) } as never);
      await lab.step(30); await lab.ready();
      a.cheats.killAll(); await lab.step(180); await lab.ready();
      const crowd = a.getState().render.crowd!;
      const corpsePages = crowd.texturedCorpsePages;
      await lab.load(horde); await lab.step(60); await lab.ready();
      return { backend: a.perf().backend, corpsePages };
    }, horde);
    await page.waitForTimeout(1500);
    expect(result.backend).toBe('webgpu');
    expect(result.corpsePages, 'frozen textured corpse pages').toBeGreaterThan(0);
    expect(failures, 'WebGPU render pipeline creation errors').toEqual([]);
  });
}
