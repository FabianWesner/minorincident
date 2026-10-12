import { strict as assert } from 'node:assert';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import { SceneSession, stopServer, writeJson, readSpec } from './session';
const tier = process.env.APC_TIER === 'low' ? 'low' : 'high';
const session = new SceneSession({ tier, viewport: tier === 'low' ? { width: 390, height: 844 } : { width: 960, height: 540 } });
const out = `test-results/epics/E30/l8-apc/${process.env.APC_COMPANION === '1' ? 'companion' : tier}`; mkdirSync(out, { recursive: true });
try {
  await session.open();
  // Read-only inspection of the parallel asset lane, without copying its files into this lane.
  if (process.env.APC_VARIANT_ROOT) {
    const root = process.env.APC_VARIANT_ROOT;
    const definition = JSON.parse(readFileSync(resolve(root, 'src/assets/manifest.json'), 'utf8')).find((a: { id: string }) => a.id === 'veh.military-apc');
    await session.page.route('**/assets/models/veh.military-apc.unarmed*.glb', route => route.fulfill({ path: resolve(root, 'public/assets/models', new URL(route.request().url()).pathname.split('/').at(-1)!) }));
    await session.page.evaluate(async definition => {
      const registryModule = '/src/assets/registry.ts';
      const { AssetRegistry } = await import(registryModule);
      const prototype = AssetRegistry.prototype as import('../../src/assets/registry').AssetRegistry, original = prototype.definition;
      prototype.definition = function(id: string) { return id === 'veh.military-apc' ? definition : original.call(this, id); };
    }, definition);
  }
  await session.load(readSpec(process.env.APC_COMPANION === '1' ? 'tests/scenes/l8-apc/companion.json' : 'tests/scenes/l8-apc/transport.json'));
  await session.ready();
  await session.screenshot(`${out}/before.png`);
  const cells: { frame: number; jpeg: Buffer }[] = [];
  const probes: unknown[] = [];
  for (let f = 0; f <= (process.env.APC_COMPANION === '1' ? 260 : 450); f += 6) {
    if (f) await session.step(6);
    if (f % 24 === 0) cells.push({ frame: f, jpeg: await session.snapshot() });
    const state = await session.page.evaluate(() => window.__SS__!.getState());
    probes.push({ frame: f, player: state.player, vehicles: state.render.vehicles, car: state.entities.find(e => e.vehicle), character: state.render.character });
    if (f === (process.env.APC_COMPANION === '1' ? 84 : 198)) {
      const visible = await session.screenshot(`${out}/after.png`);
      const point = await session.page.evaluate(() => {
        const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
        const vehicles = (game.view as unknown as { vehicles: { occupants: Map<number, import('three').Group & { model: import('three').Object3D }> } }).vehicles;
        const driver = vehicles.occupants.get(1)!;
        const point = game.view.camera.position.clone(); driver.model.getObjectByName('head')!.getWorldPosition(point); point.y += .1; point.project(game.view.camera);
        driver.model.visible = false; game.view.update(1);
        return { x: (point.x + 1) / 2 * innerWidth, y: (1 - point.y) / 2 * innerHeight };
      });
      const hidden = PNG.sync.read(await session.page.screenshot({ type: 'png' })), shown = PNG.sync.read(visible);
      let driverPixels = 0;
      for (let y = Math.max(0, Math.floor(point.y) - 8); y < Math.min(shown.height, point.y + 8); y++) for (let x = Math.max(0, Math.floor(point.x) - 8); x < Math.min(shown.width, point.x + 8); x++) {
        const index = (y * shown.width + x) * 4;
        if ([0, 1, 2].some(c => Math.abs(shown.data[index + c] - hidden.data[index + c]) > 15)) driverPixels++;
      }
      await session.page.evaluate(() => { const game = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game; (game.view as unknown as { vehicles: { occupants: Map<number, { model: import('three').Object3D }> } }).vehicles.occupants.get(1)!.model.visible = true; game.view.update(1); });
      writeJson(`${out}/driver-visibility.json`, { point, driverPixels });
      assert(driverPixels > 4, 'driver must be visible through the cab at the game camera');
      assert.equal(state.player!.hidden, true);
      assert(state.render.vehicles.some(v => 'occupants' in v && v.occupants.some(o => o.actorId === 1)), 'seated driver must be drawn');
    }
  }
  await session.makeSheet(cells, `${out}/before-after.jpg`);
  writeJson(`${out}/probes.json`, probes);
  const metrics = await session.metrics(); writeJson(`${out}/metrics.json`, metrics);
  const timing = await session.page.evaluate(() => {
    const world = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.world;
    const samples: number[] = [];
    for (let i = 0; i < 600; i++) { const start = performance.now(); world.update(); if (i >= 60) samples.push(performance.now() - start); }
    samples.sort((a, b) => a - b);
    return { simP95Ms: samples[Math.floor(samples.length * .95)] };
  });
  const cdp = await session.page.context().newCDPSession(session.page);
  await cdp.send('HeapProfiler.collectGarbage');
  const heap = await cdp.send('Runtime.getHeapUsage');
  const memory = { heapMB: heap.usedSize / 1_000_000 };
  await cdp.detach();
  writeJson(`${out}/timing.json`, { ...timing, ...memory });
  assert(timing.simP95Ms <= (tier === 'low' ? 6 : 4));
  assert(memory.heapMB <= (tier === 'low' ? 250 : 400));
  assert(metrics.perf.drawCalls.max !== null); assert(metrics.perf.triangles.max !== null);
  assert(metrics.perf.drawCalls.max <= (tier === 'low' ? 300 : 600));
  assert(metrics.perf.triangles.max <= (tier === 'low' ? 500000 : 1500000));
  assert.equal(session.errors.length, 0);
  console.log(JSON.stringify({ tier, errors: session.errors, perf: metrics.perf, timing, memory }));
} finally { await session.close(); stopServer(); }
