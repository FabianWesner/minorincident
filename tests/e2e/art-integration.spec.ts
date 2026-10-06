import { mkdirSync, writeFileSync } from 'node:fs';
import { devices, expect, test } from '@playwright/test';
import { attachErrorGuard } from './fixtures';
import { menuUrl, menuStart } from './ui-helpers';

// Sample profiles sequentially so their GPU loads do not distort each other's timing.
test.describe.configure({ mode: 'default' });
const phase = process.env.ART_BASELINE === '1' ? 'before' : 'after';
const output = 'test-results/art-integration';
const launchArgs = [...((process.platform === 'darwin' || process.env.ART_GPU === '1') ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']), '--enable-precise-memory-info', '--disable-background-timer-throttling'];
test.use({
  headless: true,
  launchOptions: { args: launchArgs },
});

test('real L1 uses accepted survivor, corgi and instanced mission infected @E17-AC09', async ({ page }) => {
  test.skip(phase === 'before', 'Baseline intentionally renders pre-integration art');
  const guard = attachErrorGuard(page);
  await menuStart(page);
  const proof = await page.evaluate(async () => {
    const api = window.__SS__!; api.pause();
    const player = api.getState().player!.transform;
    api.spawn('infected.runner', { x: player.x + 3, z: player.z });
    api.spawn('infected.patient-zero', { x: player.x - 3, z: player.z });
    await api.screenshotReady(); return api.getState().render;
  });
  expect(proof.character!.sources.every(source => source.source === 'glb')).toBe(true);
  expect(proof.entityAssets!.companion).toBe('glb');
  expect(proof.crowd!.batches.filter(batch => batch.instances > 0).every(batch => batch.source === 'glb')).toBe(true);
  expect(proof.crowd!.assets).toEqual([]);
  const course = await page.evaluate(async () => {
    const api = window.__SS__!; await api.loadScenario('drive-course'); api.pause(); await api.screenshotReady();
    return api.getState().render.entityAssets!;
  });
  expect(course.actors).toHaveLength(46);
  expect(course.actors.every(actor => actor.source === 'glb')).toBe(true);
  expect(course.placeholders).toEqual([]);
  guard.dispose(); expect(guard.errors).toEqual([]);
});
for (const profile of ['desktop', 'mobile'] as const) {
  test(`production art measurements ${profile}`, async ({ playwright, baseURL }) => {
    test.skip(process.env.ART_GPU !== '1' && process.env.ART_BASELINE !== '1', 'Opt-in art measurements: ART_GPU=1 (headless Metal)');
    test.setTimeout(600_000);
    mkdirSync(output, { recursive: true });
    const browser = await playwright.chromium.launch({ headless: true, args: launchArgs });
    const context = await browser.newContext(profile === 'mobile'
      ? { baseURL, ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 }
      : { baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const metrics: Record<string, unknown> = {};
    const measure = async (name: string) => {
      await cdp.send('HeapProfiler.collectGarbage');
      metrics[name] = await page.evaluate(async () => {
        const api = window.__SS__!; api.pause(); await api.screenshotReady();
        const times: number[] = [], frames: number[] = [];
        for (let i = 0; i < 15; i++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          const start = performance.now(); await api.step(0);
          if (i >= 5) times.push(performance.now() - start);
        }
        times.sort((a, b) => a - b);
        // Explicit rendering while paused keeps the same scenario/camera across samples.
        let previous = 0;
        for (let i = 0; i < 35; i++) {
          const now = await new Promise<number>(resolve => requestAnimationFrame(time => resolve(time)));
          if (i >= 5) frames.push(now - previous); previous = now;
          await api.step(0);
        }
        frames.sort((a, b) => a - b);
        const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
        const gl = document.querySelector('canvas')!.getContext('webgl2')!, debug = gl.getExtension('WEBGL_debug_renderer_info');
        return { ...api.perf(), frameP50Ms: frames[15], frameP95Ms: frames[28], renderCpuP50Ms: times[5], renderCpuP95Ms: times[9], heapMB: heap ? heap / 1048576 : null,
          assetDownloadMB: performance.getEntriesByType('resource').filter(entry => entry.name.endsWith('.glb')).reduce((sum, entry) => sum + (entry as PerformanceResourceTiming).encodedBodySize, 0) / 1048576,
          gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string : 'unknown', camera: api.getState().render.camera, character: api.getState().render.character, actors: api.getState().render.entityAssets, districts: api.getState().render.districts, crowd: api.getState().render.crowd,
          playerPixels: Math.abs(api.camera.project(api.getState().player!.transform.x, 1.8, api.getState().player!.transform.z)[1]
            - api.camera.project(api.getState().player!.transform.x, 0, api.getState().player!.transform.z)[1]) * innerHeight / 2 };
      });
      writeFileSync(`${output}/${phase}-${profile}${process.env.ART_GPU === '1' ? '-gpu' : ''}.json`, JSON.stringify(metrics, null, 2) + '\n');
      if (phase === 'after') {
        try {
        const sample = metrics[name] as { drawCalls: number; triangles: number; heapMB: number };
        expect(sample.drawCalls, name).toBeLessThanOrEqual(profile === 'desktop' ? 600 : 300);
        expect(sample.triangles, name).toBeLessThanOrEqual(profile === 'desktop' ? 1_500_000 : 500_000);
        if (name === 'L6-mainstreet' || name === 'L6-follow') expect(sample.heapMB).toBeLessThanOrEqual(profile === 'desktop' ? 400 : 250);
        } catch (error) { await context.close(); await browser.close(); throw error; }
      }

    };
    await page.goto(menuUrl.replace('quality=high', `quality=${profile === 'mobile' ? 'low' : 'high'}`));
    await page.getByTestId('start-game').click(); await page.getByTestId('character-female').click(); await page.getByTestId('level-L1').click();
    await page.getByRole('button', { name: 'Begin mission' }).click();
    await page.evaluate(async () => { window.__SS__!.pause(); await window.__SS__!.screenshotReady(); });
    await measure('L1');
    await page.screenshot({ path: `${output}/${phase}-${profile}-L1.png` });
    if (profile === 'mobile') {
      await page.setViewportSize({ width: 915, height: 412 });
      await measure('L1-landscape');
      await page.screenshot({ path: `${output}/${phase}-landscape-L1.png` });
      await page.setViewportSize({ width: 412, height: 915 });
    }
    await page.evaluate(async () => {
      const api = window.__SS__!; await api.loadScenario('horde-arena'); api.pause();
      for (let i = 0; i < 200; i++) {
        let x = i % 20 * 1.2 - 11.4; const z = Math.floor(i / 20) * 1.2 - 5.4;
        if (Math.hypot(x, z) < 2) x += Math.sign(x) * 2;
        api.spawn('infected.runner', { x, z }, { state: 'idle' });
      }
      await api.screenshotReady();
    });
    await measure('horde-200');
    await page.screenshot({ path: `${output}/${phase}-${profile}-horde.png` });
    for (const district of ['D-RES', 'D-MAIN', 'D-SCHOOL', 'D-SHOP', 'D-CIVIC', 'D-PARK', 'D-ZOO', 'D-EDGE']) {
      await page.evaluate(async district => {
        const api = window.__SS__!; await api.loadLevel(district, { tier: 5 }); api.pause();
        api.camera.follow(); await api.step(60); await api.screenshotReady();
      }, district);
      await measure(`${district}-follow`);
      if (phase === 'after') await page.screenshot({ path: `${output}/${phase}-${profile}-${district}-follow.png` });
      await page.evaluate(async district => { const api = window.__SS__!; api.camera.preset(`${district}/W5/overview`); await api.screenshotReady(); }, district);
      await measure(district);
      if (phase === 'after') await page.screenshot({ path: `${output}/${phase}-${profile}-${district}.png` });
    }
    writeFileSync(`${output}/${phase}-${profile}${process.env.ART_GPU === '1' ? '-gpu' : ''}.json`, JSON.stringify(metrics, null, 2) + '\n');
    await page.evaluate(async () => {
      const api = window.__SS__!; await api.loadLevel('L6'); api.pause();
      api.camera.follow(); await api.step(60); await api.screenshotReady();
    });
    await measure('L6-follow');
    await page.evaluate(async () => { const api = window.__SS__!; api.camera.preset('D-MAIN/W5/overview'); await api.screenshotReady(); });
    await measure('L6-mainstreet');
    expect(Object.keys(metrics)).toContain('horde-200');
    if (phase === 'before') writeFileSync(`${output}/baseline-${profile}-errors.json`, JSON.stringify(errors, null, 2) + '\n');
    await context.close();
    await browser.close();
    if (phase === 'after') expect(errors).toEqual([]);
  });
}
for (const profile of ['desktop', 'mobile'] as const) {
  test(`active 200-infected simulation ${profile}`, async ({ browser, baseURL }) => {
    test.skip(process.env.ART_LIVE !== '1', 'Opt-in live simulation timing');
    test.setTimeout(120_000);
    const context = await browser.newContext(profile === 'mobile'
      ? { baseURL, ...devices['Pixel 7'], viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 }
      : { baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage(), guard = attachErrorGuard(page);
    await page.goto(menuUrl.replace('quality=high', `quality=${profile === 'mobile' ? 'low' : 'high'}`));
    await page.waitForFunction(() => Boolean(window.__SS__));
    await page.evaluate(async () => {
      const api = window.__SS__!; await api.ready; await api.loadScenario('horde-arena'); api.pause(); api.cheats.god(true);
      for (let i = 0; i < 200; i++) api.spawn('infected.runner', { x: i % 20 * 1.2 - 11.4, z: Math.floor(i / 20) * 1.2 - 5.4 }, { state: 'chase' });
      await api.screenshotReady();
    });
    const metrics = await page.evaluate(async () => {
      const api = window.__SS__!, frames: number[] = [], simulation: number[] = []; let previous = 0;
      api.resume();
      for (let i = 0; i < 135; i++) {
        const now = await new Promise<number>(resolve => requestAnimationFrame(time => resolve(time)));
        if (i >= 15) { frames.push(now - previous); simulation.push(api.perf().simMs); }
        previous = now;
      }
      api.pause(); frames.sort((a, b) => a - b); simulation.sort((a, b) => a - b);
      return { ...api.perf(), frameP50Ms: frames[60], frameP95Ms: frames[114], simP95Ms: simulation[114], ticks: api.tick() };
    });
    mkdirSync(output, { recursive: true });
    guard.dispose();
    writeFileSync(`${output}/${phase}-${profile}-active.json`, JSON.stringify({ ...metrics, errors: guard.errors }, null, 2) + '\n');
    if (phase === 'after') {
      expect(guard.errors).toEqual([]);
      expect(metrics.drawCalls).toBeLessThanOrEqual(profile === 'desktop' ? 600 : 300);
      expect(metrics.triangles).toBeLessThanOrEqual(profile === 'desktop' ? 1_500_000 : 500_000);
      expect(metrics.simP95Ms).toBeLessThanOrEqual(profile === 'desktop' ? 4 : 6);
    }
    await context.close();
  });
}
