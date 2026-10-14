import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';

test.use({ channel: 'chrome', headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`T-E32-31-S9 @E32-AC31 @perf epilogue pull-out ${backend} ${quality} z${zoom}`, async ({ page, context }) => {
    test.setTimeout(240_000);
    await boot(page, `/?test=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1&profile=1`);
    await page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L10', { checkpoint: 'cure-disperse-ready', progression: 'L10-default', seed: 329 }); a.pause(); a.cheats.god(true);
      a.teleport('player', { x: 4002, z: -27 }); a.camera.follow(); a.input.set({ interact: true }); await a.step(1); a.input.clear();
      await a.step(6000); a.cheats.killAll(); await a.step(2); a.input.set({ interact: true }); await a.step(1); a.input.clear(); await a.step(1);
      a.teleport('player', { x: 4002, z: -9 });
      await a.audio.unlock();
    });
    expect(await page.evaluate(() => window.__SS__!.missions.state()!.states['cure-released'])).toBe(true);
    if (zoom === .5) { await page.mouse.move(800, 450); for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100); await page.evaluate(() => window.__SS__!.step(120)); }
    const result = await page.evaluate(async () => {
      const a = window.__SS__!, p95 = (v: number[]) => v.sort((x, y) => x - y)[Math.ceil(v.length * .95) - 1];
      const rows: { elapsed: number; frameP95: number; simP95: number; zoom: number; radius: number }[] = [];
      let cycleSave: ReturnType<typeof a.campaign.state> = null;
      let draws = 0, triangles = 0, resident = 0, infected = 0, voices = 0, smoke = 0, corpses = 0;
      let particles = 0, gibs = 0, debris = 0, awakeProps = 0, heroLights = 0, heroShadow = 0;
      for (const elapsed of [6840, 7920, 8700]) {
        a.pause(); await a.step(elapsed - a.missions.state()!.cureFront!.elapsed);
        if (!cycleSave) { a.campaign.save(); cycleSave = a.campaign.state(); }
        a.resume(); await a.screenshotReady();
        const warm = performance.now(); while (performance.now() - warm < 1000) await new Promise(r => requestAnimationFrame(r));
        const frames: number[] = [], sims: number[] = []; let last = 0; const start = performance.now();
        while (performance.now() - start < 2500) {
          const now = await new Promise<number>(r => requestAnimationFrame(r)); if (last) frames.push(now - last); last = now;
          const p = a.perf(); if (p.simTickMs > 0) sims.push(p.simTickMs);
          draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles); resident = Math.max(resident, p.terrain?.resident ?? 0);
          infected = Math.max(infected, p.infected?.count ?? 0); voices = Math.max(voices, a.audio.snapshot().voices);
          awakeProps = Math.max(awakeProps, p.awakeProps); heroLights = Math.max(heroLights, p.lighting?.heroLights ?? 0); heroShadow = Math.max(heroShadow, p.lighting?.heroShadow ?? 0);
          particles = Math.max(particles, (p.effects?.particles ?? 0) + (p.effects?.blasts.puffs ?? 0)); gibs = Math.max(gibs, p.effects?.gibs ?? 0); debris = Math.max(debris, p.effects?.blasts.parts ?? 0);
          const vfx = a.getState().render.vfx; smoke = Math.max(smoke, vfx?.blasts.puffs ?? 0);
        }
        a.pause(); const state = a.getState(); corpses = Math.max(corpses, state.entities.filter(e => e.corpse).length);
        rows.push({ elapsed, frameP95: p95(frames), simP95: p95(sims), zoom: state.render.camera.zoom, radius: state.render.camera.radius });
      }
      return { cycleSave, backend: a.perf().backend, quality: a.getState().render.quality, rows, draws, triangles, resident, infected, voices, smoke, corpses, particles, gibs, debris, awakeProps, heroLights, heroShadow, survivors: a.missions.state()!.epilogue!.survivors.length };
    });
    const cdp = await context.newCDPSession(page), cycles: { heapMB: number; geometries: number; textures: number; corpses: number }[] = [];
    for (let cycle = 0; cycle < 6; cycle++) {
      // Keep the same saved pull phase while warming and revisiting R1/R7; do not let credits end the memory fixture.
      await page.evaluate(async save => { const a = window.__SS__!; a.campaign.restore(save!); await a.loadLevel('L10'); a.pause(); }, result.cycleSave);
      for (const at of [{ x: 154, z: -1 }, { x: 4002, z: -9 }]) await page.evaluate(async at => {
        const a = window.__SS__!; a.teleport('player', at); a.camera.follow(); a.resume(); await a.screenshotReady();
        const warm = performance.now(); while (performance.now() - warm < 1100) await new Promise(r => requestAnimationFrame(r)); a.pause();
      }, at);
      await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
      const p = await page.evaluate(() => ({ perf: window.__SS__!.perf(), corpses: window.__SS__!.getState().entities.filter(e => e.corpse).length }));
      cycles.push({ heapMB: heap.usedSize / 1e6, geometries: p.perf.geometries, textures: p.perf.textures, corpses: p.corpses });
    }
    const heapMB = Math.max(...cycles.map(c => c.heapMB));
    const out = 'test-results/epics/E32/S9/perf'; mkdirSync(out, { recursive: true }); writeFileSync(`${out}/${backend}-${quality}-z${zoom}.json`, JSON.stringify({ ...result, cycleSave: undefined, heapMB, cycles }, null, 2));
    expect(result.backend).toBe(backend); expect(result.quality).toBe(quality);
    for (const row of result.rows) { expect(row.zoom).toBeCloseTo(zoom, 2); expect(row.frameP95).toBeLessThanOrEqual(quality === 'low' ? 33.3 : 16.7); expect(row.simP95).toBeLessThanOrEqual(quality === 'low' ? 6 : 4); }
    expect(result.draws).toBeLessThanOrEqual(quality === 'low' ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(quality === 'low' ? 500000 : 1500000);
    expect(result.resident).toBeLessThanOrEqual(quality === 'low' ? 9 : 25); expect(result.infected).toBeLessThanOrEqual(quality === 'low' ? 100 : 200);
    expect(heapMB).toBeLessThanOrEqual(quality === 'low' ? 250 : 400); expect(result.voices).toBeLessThanOrEqual(quality === 'low' ? 16 : 32);
    expect(result.smoke).toBeLessThanOrEqual(quality === 'low' ? 120 : 400); expect(result.survivors).toBe(quality === 'low' ? 3 : 6);
    expect(result.particles).toBeLessThanOrEqual(quality === 'low' ? 2000 : 6000); expect(result.gibs).toBeLessThanOrEqual(quality === 'low' ? 30 : 80); expect(result.debris).toBeLessThanOrEqual(quality === 'low' ? 40 : 120);
    expect(result.awakeProps).toBeLessThanOrEqual(quality === 'low' ? 60 : 150); expect(result.heroLights).toBeLessThanOrEqual(quality === 'low' ? 3 : 8); expect(result.heroShadow).toBeLessThanOrEqual(quality === 'low' ? 1 : 3);
    expect(result.corpses).toBeGreaterThanOrEqual(quality === 'low' ? 75 : 140);
    for (const cycle of cycles.slice(1)) {
      for (const key of ['heapMB', 'geometries', 'textures'] as const) expect(Math.abs(cycle[key] - cycles[0][key]) / cycles[0][key], `warmed ${key}`).toBeLessThanOrEqual(.1);
      expect(cycle.corpses).toBeGreaterThanOrEqual(quality === 'low' ? 75 : 140);
    }
  });
}
