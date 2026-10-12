import { strict as assert } from 'node:assert';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SceneSession, stopServer, writeJson, readSpec } from './session';
const tier = process.env.APC_TIER === 'low' ? 'low' : 'high';
const session = new SceneSession({ tier, viewport: tier === 'low' ? { width: 390, height: 844 } : { width: 960, height: 540 } });
const out = `test-results/epics/E30/l8-apc/${tier}`; mkdirSync(out, { recursive: true });
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
  await session.load(readSpec('tests/scenes/l8-apc/transport.json'));
  await session.ready();
  await session.screenshot(`${out}/before.png`);
  const cells: { frame: number; jpeg: Buffer }[] = [];
  const probes: unknown[] = [];
  for (let f = 0; f <= 450; f += 6) {
    if (f) await session.step(6);
    if (f % 24 === 0) cells.push({ frame: f, jpeg: await session.snapshot() });
    const state = await session.page.evaluate(() => window.__SS__!.getState());
    probes.push({ frame: f, player: state.player, vehicles: state.render.vehicles, car: state.entities.find(e => e.vehicle), character: state.render.character });
    if (f === 198) {
      await session.screenshot(`${out}/after.png`);
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
