import { mkdirSync, writeFileSync } from 'node:fs';
import { boot, expect, test } from '../fixtures';
import { cure } from '../../../src/levels/L10/district';
import { l6Doors } from '../../../src/data/l6';

test.use({ launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] } });

const output = 'test-results/wave3-sim';
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`T-E24-06-frustum @E24-AC06 ${backend} ${quality} z${zoom} first and second appearances use offscreen maintenance accesses`, async ({ page }) => {
    test.setTimeout(180_000);
    await boot(page, `/?test=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.evaluate(async () => {
      const api = window.__SS__!; await api.loadLevel('L6', { seed: 3 }); api.missions.begin(); api.pause(); api.cheats.god(true);
      api.camera.follow();  await api.step(2); await api.screenshotReady();
    });
    await page.evaluate(quality => window.__SS__!.settings.set({ quality }), quality);
    expect(await page.evaluate(() => window.__SS__!.getState().render.quality)).toBe(quality);
    if (zoom === .5) {
      for (let notch = 0; notch < 5; notch++) await page.mouse.wheel(0, -100);
      await page.waitForFunction(() => window.__SS__!.getState().render.camera.targetZoom === .5);
    }
    await page.evaluate(() => window.__SS__!.step(120));
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    const result = await page.evaluate(async () => {
      const api = window.__SS__!, state = api.missions.state()!.l6!, appearances = [];
      const known = new Set<number>();
      for (let tick = api.tick(); tick <= state.breach2At + 32; tick++) {
        await api.step(1);
        for (const spawn of api.missions.state()!.l6!.spawnLog.filter(s => s.wave <= 2 && !known.has(s.id))) {
          known.add(spawn.id);
          const e = api.getEntity(spawn.id)!;
          const corners = [-.5, .5].flatMap(dx => [-.5, .5].flatMap(dz => [.1, 1.9].map(y => api.camera.project(spawn.x + dx, .6 + y, spawn.z + dz))));
          appearances.push({ ...spawn, at: e.transform, corners });
        }
      }
      return { appearances, state: api.missions.state()!.l6 };
    });
    expect(result.appearances.filter(s => s.wave === 1)).toHaveLength(2);
    const second = result.appearances.filter(s => s.wave === 2);
    expect(second).toHaveLength(8); expect(new Set(second.map(s => s.door)).size).toBeGreaterThanOrEqual(2);
    for (const spawn of result.appearances) {
      expect(Math.hypot(spawn.x - l6Doors[spawn.door].x, spawn.z - l6Doors[spawn.door].z)).toBeLessThanOrEqual(3);
      expect(spawn.offscreen).toBe(true);
      for (const [x, y, z] of spawn.corners) expect(Math.abs(x) > 1 || Math.abs(y) > 1 || Math.abs(z) > 1).toBe(true);
    }
    mkdirSync(output, { recursive: true });
    writeFileSync(`${output}/breach-${backend}-${quality}-z${zoom}.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${output}/breach-${backend}-${quality}-z${zoom}.png` });
  });

  test(`T-E32-28-all-seams @E32-AC28 ${backend} ${quality} z${zoom} D-CURE delayed loads and live input reversals`, async ({ page }) => {
    test.setTimeout(300_000);
    await boot(page, `/?test=1&renderer=${backend}&quality=${quality}&audio=muted&dpr=1`);
    await page.evaluate(async () => { const api = window.__SS__!; await api.loadLevel('L10', { seed: 32 }); api.missions.begin(); api.pause(); api.cheats.god(true); api.camera.follow();  });
    await page.evaluate(quality => window.__SS__!.settings.set({ quality }), quality);
    expect(await page.evaluate(() => window.__SS__!.getState().render.quality)).toBe(quality);
    if (zoom === .5) {
      for (let notch = 0; notch < 5; notch++) await page.mouse.wheel(0, -100);
      await page.waitForFunction(() => window.__SS__!.getState().render.camera.targetZoom === .5);
    }
    await page.evaluate(() => window.__SS__!.step(120));
    expect(await page.evaluate(() => window.__SS__!.getState().render.camera.zoom)).toBeCloseTo(zoom, 2);
    expect(await page.evaluate(() => window.__SS__!.perf().backend)).toBe(backend);
    let delayed = 0;
    await page.route('**/D-CURE.chunks/*.glb*', async route => { delayed++; await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
    const evidence = [];
    for (const region of cure.regions.slice(1)) {
      const [x, z] = region.route[0];
      const before = await page.evaluate(({ x, z }) => {
        const api = window.__SS__!; api.teleport('player', { x: x - 4, z }); api.camera.follow();
        return { start: api.getState().player!.transform, tick: api.tick() };
      }, { x, z });
      const samples = [];
      for (const keys of [['KeyD', 'KeyS'], ['KeyA', 'KeyW'], ['KeyD', 'KeyS']]) {
        for (const key of keys) await page.keyboard.down(key);
        samples.push(...await page.evaluate(async () => {
          const api = window.__SS__!, samples = [];
          for (let i = 0; i < 150; i++) {
            await api.step(1);
            samples.push({ ...api.getState().player!.transform, terrain: api.perf().terrain });
          }
          return samples;
        }));
        for (const key of keys) await page.keyboard.up(key);
      }
      const result = { start: before.start, ticks: await page.evaluate(() => window.__SS__!.tick()) - before.tick, samples };
      expect(result.ticks).toBe(450);
      expect(Math.max(...result.samples.map(s => s.x))).toBeGreaterThan(x + 1);
      expect(Math.min(...result.samples.slice(150, 300).map(s => s.x))).toBeLessThan(x - 1);
      for (const sample of result.samples) {
        expect(sample.y).toBeGreaterThanOrEqual(.65);
        expect(sample.terrain!.resident).toBeLessThanOrEqual(quality === 'high' ? 25 : 9);
      }
      expect(result.samples.some(s => (s.terrain?.loading ?? 0) > 0), `${region.id} has delayed loads during input`).toBe(true);
      evidence.push({ region: region.id, x, z, ...result });
      console.log(JSON.stringify({ seam: region.id, backend, quality, zoom, delayed, minX: Math.min(...result.samples.map(s => s.x)), maxX: Math.max(...result.samples.map(s => s.x)) }));
      await page.evaluate(() => window.__SS__!.screenshotReady());
      mkdirSync(output, { recursive: true });
      await page.screenshot({ path: `${output}/seam-${region.id}-${backend}-${quality}-z${zoom}.png` });
    }
    expect(delayed).toBeGreaterThan(0);
    writeFileSync(`${output}/seams-${backend}-${quality}-z${zoom}.json`, JSON.stringify(evidence, null, 2));
    await page.unrouteAll({ behavior: 'wait' });
  });
}
