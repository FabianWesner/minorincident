import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, boot } from '../e2e/fixtures';
import type { Renderer } from '../../src/render/Renderer';
import type { Object3D, Mesh } from 'three/webgpu';
import type { Game } from '../../src/Game';

test.use({ channel: 'chrome', headless: true, trace: 'off', launchOptions: { args: ['--use-angle=metal', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--disable-gpu-vsync'] } });
for (const backend of ['webgl', 'webgpu'] as const) for (const quality of ['high', 'low'] as const) for (const zoom of [1, .5]) {
  test(`T-E32-28-residency @E32-AC28 @perf first-play R7 LOD residency ${backend} ${quality} z${zoom}`, async ({ page, context }) => {
    test.setTimeout(120_000);
    await boot(page, `/?test=1&scenelab=1${backend === 'webgl' ? '&renderer=webgl' : ''}&quality=${quality}&audio=muted&dpr=1&profile=1&loadProfile=1`);
    await page.evaluate(() => {
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const renderer = (game.view as unknown as { renderer: Renderer }).renderer;
      const trace = window as unknown as { gunWarmBuilds: unknown[] }; trace.gunWarmBuilds = [];
      const previous = renderer.debug.onNodeBuilderCreated;
      renderer.debug.onNodeBuilderCreated = (builder, object) => {
        previous?.(builder, object);
        const draw = object as unknown as { object: Mesh; material: Mesh['material']; context: { id: number } };
        let asset: string | undefined;
        for (let o: Object3D | null = draw.object; o; o = o.parent) asset ??= o.userData.assetId;
        const material = Array.isArray(draw.material) ? draw.material[0] : draw.material;
        if (asset === 'wpn.minigun-mounted' && material.name === 'pal_picketWhite') {
          const lights: string[] = [];
          game.view.scene.traverseVisible(o => { if ('isLight' in o) lights.push(o.type); });
          trace.gunWarmBuilds.push({ tick: game.world.tick, object: draw.object.uuid, material: material.uuid, version: material.version, context: draw.context.id, key: material.customProgramCacheKey(), lights });
        }
      };
    });
    const loadedGun = await page.evaluate(async () => {
      const a = window.__SS__!;
      await a.loadLevel('L10', { seed: 32, checkpoint: 'cure-disperse-ready' }); a.pause(); a.cheats.god(true);
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      const gun = (game.view as unknown as { mountedGunView?: Object3D }).mountedGunView;
      const loaded = { present: !!gun, children: gun?.children.length, visible: gun?.visible, resident: game.world.mountedGun && game.world.chunks?.resident(game.world.mountedGun.placement.x, game.world.mountedGun.placement.z), scenario: game.world.scenario, player: { ...game.world.entities.get(1)!.transform } };
      a.teleport('player', { x: 3960, z: -27 }); a.camera.follow();
      return loaded;
    });
    if (zoom === .5) { await page.mouse.move(800, 450); for (let i = 0; i < 5; i++) await page.mouse.wheel(0, -100); }
    await page.evaluate(async () => { const a = window.__SS__!; await a.step(120); await a.screenshotReady(); });
    const result = await page.evaluate(async () => {
      const a = window.__SS__!;
      // Keep the API while exercising production admission, including the first four seconds.
      const game = (window.__SCENE__ as unknown as { game: Game }).game;
      (game.view as unknown as { params: URLSearchParams }).params.delete('test');
      const district = game.view.labProbes().districts!;
      const renderer = (game.view as unknown as { renderer: Renderer }).renderer;
      const builds: { tick: number; path: string[]; asset?: string; material: string; transparent: boolean; side: number; castShadow: boolean; receiveShadow: boolean; attributes: string[] }[] = [];
      const onBuild = renderer.debug.onNodeBuilderCreated;
      renderer.debug.onNodeBuilderCreated = (builder, object) => {
        onBuild?.(builder, object);
        const draw = object as unknown as { object: Mesh; material: Mesh['material'] };
        const path: string[] = []; let asset: string | undefined;
        for (let o: Object3D | null = draw.object; o; o = o.parent) { path.push(o.name || o.type); asset ??= o.userData.assetId; }
        const material = Array.isArray(draw.material) ? draw.material[0] : draw.material;
        builds.push({ tick: a.tick(), path, asset, material: material.name, transparent: material.transparent, side: material.side, castShadow: draw.object.castShadow, receiveShadow: draw.object.receiveShadow, attributes: Object.keys(draw.object.geometry?.attributes ?? {}) });
      };
      const warmBuilds = [...(window as unknown as { gunWarmBuilds: unknown[] }).gunWarmBuilds];
      const gunView = (game.view as unknown as { mountedGunView?: Object3D }).mountedGunView;
      const gunBefore = { present: !!gunView, children: gunView?.children.length, resident: game.world.mountedGun && game.world.chunks?.resident(game.world.mountedGun.placement.x, game.world.mountedGun.placement.z) };
      const frames: number[] = [], sims: number[] = [], bad: unknown[] = [], hitches: unknown[] = [];
      const p95 = (v: number[]) => v.sort((x, y) => x - y)[Math.ceil(v.length * .95) - 1];
      let last = 0, draws = 0, triangles = 0, resident = 0, infected = 0;
      a.input.set({ moveTarget: { x: 3997, z: -27 }, pointerGround: true, navigation: true } as never); a.resume();
      const start = performance.now();
      while (performance.now() - start < 10_000) {
        const now = await new Promise<number>(r => requestAnimationFrame(r));
        const dt = last ? now - last : 0;
        if (last) frames.push(dt); last = now;
        const p = a.perf(), standIns = district.placeholderDraws();
        if (dt > 20) hitches.push({ dt, elapsedMs: now - start, tick: a.tick(), x: a.getEntity(1)!.transform.x, simMs: p.simMs, simTickMs: p.simTickMs, updateCpuMs: p.updateCpuMs, renderCpuMs: p.renderCpuMs, nodeBuilds: p.nodeBuilds, materials: { ...renderer.nodeBuildMaterials } });
        if (p.simTickMs > 0) sims.push(p.simTickMs);
        if (standIns.length) bad.push({ tick: a.tick(), assets: standIns });
        draws = Math.max(draws, p.drawCalls); triangles = Math.max(triangles, p.triangles);
        resident = Math.max(resident, p.terrain?.resident ?? 0); infected = Math.max(infected, p.infected?.count ?? 0);
      }
      a.pause(); a.input.clear(); const state = a.getState();
      renderer.debug.onNodeBuilderCreated = onBuild;
      return { builds, warmBuilds, gunBefore, gunAllBuilds: (window as unknown as { gunWarmBuilds: unknown[] }).gunWarmBuilds, frameP95: p95(frames), frameMax: Math.max(...frames), simP95: p95(sims), frames: frames.length, hitches, badFrames: bad.length, first: bad.slice(0, 3), draws, triangles, resident, infected, x: state.player!.transform.x, cameraZoom: state.render.camera.zoom, quality: a.perf().quality.tier, backend: a.perf().backend };
    });
    const cdp = await context.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); const heap = await cdp.send('Runtime.getHeapUsage');
    const heapMB = heap.usedSize / 1e6;
    const out = 'test-results/lod-standins/perf/startup'; mkdirSync(out, { recursive: true });
    await page.screenshot({ path: `${out}/${backend}-${quality}-z${zoom}.png` });
    writeFileSync(`${out}/${backend}-${quality}-z${zoom}.json`, JSON.stringify({ ...result, loadedGun, heapMB }, null, 2));
    expect(result.backend).toBe(backend); expect(result.quality).toBe(quality); expect(result.cameraZoom).toBeCloseTo(zoom, 2);
    expect(result.x).toBeGreaterThan(3995); expect(result.badFrames).toBe(0);
    expect(result.builds.filter(b => b.material === 'pal_picketWhite' && b.path.includes('body')), 'mounted gun programs must be built behind the loading card').toEqual([]);
    expect(result.frameP95).toBeLessThanOrEqual(quality === 'low' ? 33.3 : 16.7); expect(result.simP95).toBeLessThanOrEqual(quality === 'low' ? 6 : 4);
    expect(result.frameMax, 'desktop streaming hitch at either quality').toBeLessThanOrEqual(50);
    expect(result.draws).toBeLessThanOrEqual(quality === 'low' ? 300 : 600); expect(result.triangles).toBeLessThanOrEqual(quality === 'low' ? 500000 : 1500000);
    expect(result.resident).toBeLessThanOrEqual(quality === 'low' ? 9 : 25); expect(result.infected).toBeLessThanOrEqual(quality === 'low' ? 100 : 200); expect(heapMB).toBeLessThanOrEqual(quality === 'low' ? 250 : 400);
  });
}
