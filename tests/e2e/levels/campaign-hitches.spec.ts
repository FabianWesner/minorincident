import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { boot, expect, test } from '../fixtures';
import type { Game } from '../../../src/Game';

// Real clock + physical keys. Run with quiet-run (one worker); each reservation is <20 min.
// HITCH_PHASE=before records the failing baseline without suppressing assertions in later runs.
const phase = process.env.HITCH_PHASE ?? 'after';
const backends = process.env.HITCH_BACKEND ? [process.env.HITCH_BACKEND] : ['webgl', 'webgpu'];
test.use({ headless: true, launchOptions: { args: ['--use-angle=metal', '--enable-gpu', '--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] } });
for (const backend of backends) for (const quality of ['low', 'high'] as const) for (const level of ['L8', 'L6', 'L5'] as const) {
  test(`T-E18-campaign-hitch @E18 @perf ${level} ${backend} ${quality}`, async ({ page, context }) => {
    test.setTimeout(240_000);
    const out = `test-results/campaign-hitches/${phase}/${backend}-${quality}-${level}`;
    mkdirSync(out, { recursive: true });
    await boot(page, `/?test=1&scenelab=1&ui=1&${backend === 'webgl' ? 'renderer=webgl&' : ''}quality=${quality}&audio=muted&dpr=1&loadProfile=2&profile=1`);
    if (process.env.HITCH_DIAG === '1') await page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game, renderer = game.view.renderer;
      const log = { phase: 'load', records: [] as unknown[] };
      (window as unknown as { hitchLoad: typeof log }).hitchLoad = log;
      const original = renderer.debug.onNodeBuilderCreated;
      renderer.debug.onNodeBuilderCreated = (builder, object) => {
        original?.(builder, object);
        const d = object as unknown as { getMaterialCacheKey(): number; getDynamicCacheKey(): number; initialCacheKey: number; material: { name: string; uuid: string; version: number; weatherMode?: number }; object: { name: string; uuid: string; receiveShadow: boolean; geometry?: { attributes: Record<string, unknown> } }; lightsNode: { getCacheKey(force: boolean): number }; context: { id: number }; scene: { name: string } };
        const parents = [];
        for (let node = d.object as unknown as import('three').Object3D | null; node; node = node.parent) parents.push({ name: node.name, asset: node.userData.assetId, entity: node.userData.entityId, placement: node.userData.placementId });
        log.records.push({ phase: log.phase, tick: game.world.tick, material: d.material.name, uuid: d.material.uuid, version: d.material.version, mode: d.material.weatherMode, object: d.object.name, objectId: d.object.uuid, key: d.initialCacheKey, materialKey: d.getMaterialCacheKey(), dynamicKey: d.getDynamicCacheKey(), lights: d.lightsNode.getCacheKey(true), context: d.context.id, attributes: Object.keys(d.object.geometry?.attributes ?? {}), shadow: d.object.receiveShadow, parents });
      };
    });
    await page.evaluate(async ({ level, quality }) => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      // Campaign defaults otherwise override the URL quality at UI.loaded(). Set the saved
      // quality before view.load(), so this measures the tier that actually warmed at load.
      await game.loadLevel(level, { seed: 1, progression: `${level}-default` as 'L8-default', setup: () => a.settings.set({ quality }) });
      a.pause(); a.missions.begin(); a.cheats.god(true); a.camera.follow();
      if (level === 'L6') {
        a.cheats.completeObjective('shelter'); a.cheats.completeObjective('stop'); a.cheats.completeObjective('retreat');
        game.world.missions!.state.l6!.flashlight = true;
        game.world.missions!.state.items.push('headlamp');
        a.missions.state()!.l6!.survivors.forEach((r, i) => a.teleport(r.id, { x: 266 + Math.floor(i / 3) * .8, z: 15 + (i % 3 - 1) * .8 }));
        a.teleport('player', { x: 255, z: 15 });
      }
      if (level === 'L5') {
        a.cheats.completeObjective('emerge');
        // Walk into the authored flashlight pool beside Sam's bus. Its footprint is
        // centred at (-46.48, 39.97), in front of the Lakeshore fence.
        a.teleport('player', { x: -46.5, z: 35 });
      }
      // Set the rig without drawing: first-use work and L8's first tick belong to the measurement.
      game.view.view.reset(a.getEntity(1)!.transform);
      game.view.view.zoom(Math.log(1.5), true);
      game.view.view.update(a.getEntity(1)!.transform, 1);
    }, { level, quality });
    expect(await page.evaluate(() => window.__SS__!.perf().quality.tier)).toBe(quality);
    if (process.env.HITCH_DIAG === '1') await page.evaluate(() => { (window as unknown as { hitchLoad: { phase: string } }).hitchLoad.phase = 'play'; });
    // Mission/menu controls may have retained focus. Physical keys must reach the game.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    const keys = level === 'L8' ? ['w', 'd'] : level === 'L5' ? ['s', 'a'] : ['s', 'd'];
    if (process.env.HITCH_VISUAL === '1') {
      for (const key of keys) await page.keyboard.down(key);
      await page.evaluate(() => window.__SS__!.step(360));
      for (const key of keys) await page.keyboard.up(key);
      await page.evaluate(async () => { await window.__SS__!.screenshotReady(); });
      const pixels = await page.locator('canvas').screenshot();
      writeFileSync(`${out}/fixed-tick.png`, pixels);
      const population = await page.evaluate(() => window.__SS__!.query({}).map(e => ({ id: e.id, archetype: e.archetype, corpse: e.corpse, health: e.health.current })).sort((a, b) => a.id - b.id));
      writeFileSync(`${out}/population.json`, JSON.stringify(population, null, 2));
      if (phase !== 'before') {
        const baseline = out.replace(`/${phase}/`, '/before/'), a = PNG.sync.read(readFileSync(`${baseline}/fixed-tick.png`)), b = PNG.sync.read(pixels), diff = new PNG({ width: a.width, height: a.height });
        const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: .1 });
        writeFileSync(`${out}/diff.png`, PNG.sync.write(diff));
        const totalPixels = a.width * a.height;
        writeFileSync(`${out}/pixel-compare.json`, JSON.stringify({ changed, pixels: totalPixels, fraction: changed / totalPixels }));
        expect(population).toEqual(JSON.parse(readFileSync(`${baseline}/population.json`, 'utf8')));
        // Permit at most 0.001% raster-edge variation; keep every differing pixel in diff.png.
        expect(changed / totalPixels).toBeLessThanOrEqual(.00001);
      }
      return;
    }
    const cdp = await context.newCDPSession(page);
    if (process.env.HITCH_CPU === '1') { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
    await page.evaluate(() => {
      const a = window.__SS__!, game = (window.__SCENE__ as unknown as { game: Game }).game;
      const probe = { frames: [] as unknown[], builds: [] as unknown[], stopped: false, previous: 0, start: performance.now(), keys: { ...a.perf().nodeBuildMaterials } };
      (window as unknown as { hitch: typeof probe }).hitch = probe;
      const original = game.view.renderer.debug.onNodeBuilderCreated;
      game.view.renderer.debug.onNodeBuilderCreated = (builder, object) => {
        original?.(builder, object);
        const draw = object as unknown as { material: { name: string; type: string }; object: import('three').Object3D };
        const parents = [];
        for (let node: import('three').Object3D | null = draw.object; node; node = node.parent) parents.push({ name: node.name, asset: node.userData.assetId });
        probe.builds.push({ t: performance.now() - probe.start, tick: a.tick(), material: draw.material.name || draw.material.type, object: draw.object.name || draw.object.parent?.name, parents });
      };
      const frame = (now: number) => {
        if (probe.previous) { const p = a.perf(); probe.frames.push({ t: now - probe.start, ms: now - probe.previous, tick: a.tick(), sim: p.simMs, update: p.updateCpuMs, render: p.renderCpuMs, builds: p.nodeBuilds, lighting: p.lighting, position: a.getEntity(1)!.transform, move: { ...game.world.inputFrame.move } }); }
        probe.previous = now; if (!probe.stopped) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    for (const key of keys) await page.keyboard.down(key);
    await page.evaluate(() => window.__SS__!.resume());
    await page.waitForTimeout(level === 'L8' ? 6000 : 9000);
    for (const key of keys) await page.keyboard.up(key);
    const result = await page.evaluate(() => {
      const a = window.__SS__!, p = (window as unknown as { hitch: { frames: { ms: number }[]; builds: unknown[]; keys: Record<string, number>; stopped: boolean } }).hitch;
      p.stopped = true; a.pause();
      return { frames: p.frames, builds: p.builds, max: Math.max(...p.frames.map(f => f.ms)), over100: p.frames.filter(f => f.ms > 100), newPrograms: Object.fromEntries(Object.entries(a.perf().nodeBuildMaterials).map(([k, n]) => [k, n - (p.keys[k] ?? 0)]).filter(([, n]) => Number(n) > 0)), perf: a.perf(), state: a.getState(), exitAt: a.missions.state()?.l6?.exitAt };
    });
    if (process.env.HITCH_CPU === '1') writeFileSync(`${out}/cpu.cpuprofile`, JSON.stringify((await cdp.send('Profiler.stop')).profile));
    writeFileSync(`${out}/result.json`, JSON.stringify(result, null, 2));
    if (process.env.HITCH_DIAG === '1') writeFileSync(`${out}/load-builds.json`, JSON.stringify(await page.evaluate(() => (window as unknown as { hitchLoad: unknown }).hitchLoad), null, 2));
    await page.locator('canvas').screenshot({ path: `${out}/after.png` });
    console.log(`${level} ${backend} ${quality}: ${result.max.toFixed(1)} ms; ${result.builds.length} node builds; end ${JSON.stringify(result.state.player?.transform)}`);
    expect(result.perf.backend).toBe(backend);
    expect(result.perf.quality.tier).toBe(quality);
    if (phase !== 'before') expect(result.over100).toEqual([]);
    if (level === 'L6') expect(result.exitAt).toBeGreaterThan(0);
    if (level === 'L5') expect(result.state.player!.transform.z).toBeGreaterThan(39.8);
    if (level === 'L8') { expect(result.state.tick).toBeGreaterThan(120); expect(result.state.player!.transform.z).toBeLessThan(68); }
  });
}
