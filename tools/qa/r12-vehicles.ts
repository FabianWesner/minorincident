/** PO r12: real keyboard directions and small in-memory vehicle review sheet.
 * Run with SCENE_PORT=<unused port> sh tools/e2e-lock.sh node --import tsx/esm tools/qa/r12-vehicles.ts.
 * Uses current sources via SceneSession's dev server; no production build/capture dump. */
import assert from 'node:assert/strict';
import { SceneSession, stopServer, writeJson } from '../scenelab/session';
import { vehicles } from '../../src/data/vehicles';

const out = 'docs/reports/r12-vehicles';
const evidence: Record<string, unknown>[] = [];
const cells: { frame: number; jpeg: Buffer }[] = [];
const labels: string[] = [];
let session = new SceneSession();
async function capture(label: string): Promise<void> {
  labels.push(label); cells.push({ frame: labels.length, jpeg: await session.snapshot() });
}
async function key(code: string, ticks: number): Promise<void> {
  await session.page.keyboard.down(code);
  try { await session.page.evaluate(n => window.__SS__!.step(n), ticks); }
  finally { await session.page.keyboard.up(code); }
}
try {
  await session.open();
  // Every driven definition shares the same keyboard heading rule. Test physical
  // arrows and WASD while facing map north, and project the sampled intent back
  // through the live game camera rather than assuming an isometric azimuth.
  for (const def of vehicles) {
    await session.load({ name: `r12-${def.id}`, ground: 'asphalt', size: 150,
      vehicles: [{ id: 'car', asset: def.id, at: [0, 0], yaw: 90 }],
      actors: [{ id: 'courier', kind: 'courier', at: [def.width / 2 + .55, -def.doorX] }],
      camera: { mode: 'game', target: [0, 0], zoom: 1 }, frames: 0 });
    await session.page.evaluate(async () => {
      const a = window.__SS__!; a.input.set({ interact: true }); await a.step(1); a.input.clear(); await a.step(60);
    });
    const driven = await session.page.evaluate(() => window.__SS__!.query({}).find(e => e.vehicle?.driver === 1)?.id);
    assert.ok(driven, `${def.id}: entered via driver door`);
    for (const [code, axis, sign] of [['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1], ['ArrowUp', 'y', -1], ['ArrowDown', 'y', 1], ['KeyA', 'x', -1], ['KeyD', 'x', 1]] as const) {
      await key(code, 1);
      const direction = await session.page.evaluate(() => {
        const a = window.__SS__!, s = a.getState(), p = a.getEntity(1)!.transform, m = s.input.frame.move;
        const from = a.input.project(p), to = a.input.project({ x: p.x + m.x, z: p.z + m.z });
        return { x: to.x - from.x, y: to.y - from.y, scheme: s.input.scheme };
      });
      assert.ok(direction[axis] * sign > 1, `${def.id} ${code}: ${JSON.stringify(direction)}`);
    }
    await key('ArrowUp', 120);
    const state = await session.page.evaluate(id => window.__SS__!.getEntity(id)!, driven);
    assert.ok(state.vehicle!.speed > .3, `${def.id}: real keyboard moves vehicle`);
    evidence.push({ vehicle: def.id, northFacingKeyboard: 'pass', speed: state.vehicle!.speed });
    await session.page.evaluate(p => window.__SCENE__!.setCamera({ mode: 'game', target: [p.x, p.z], zoom: 1 }), state.transform);
    if (def.id === 'vehicle.military-apc') {
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: [0, 1, 0], radius: 9, azimuth: 45 }));
      // Follow the actual final car position for the close review.
      await session.page.evaluate(p => window.__SCENE__!.setCamera({ mode: 'close', target: [p.x, 1, p.z], radius: 9, azimuth: 45 }), state.transform);
    }
    await capture(def.id);
    console.log(`${def.id}: keyboard pass`);
  }
  await session.close(); stopServer();
  for (const tier of ['low', 'high'] as const) {
    session = new SceneSession({ tier }); await session.open();
    await session.page.evaluate(async () => {
      const a = window.__SS__!; await a.loadLevel('L9', { progression: 'L9-default' }); a.pause(); a.bot.stop(); a.inspect.enable(false); a.camera.follow(); a.missions.begin(); await a.step(1);
    });
    const before = await session.page.evaluate(() => {
      const a = window.__SS__!, e = a.query({}).find(e => e.vehicle?.driver === 1);
      return { car: e, camera: a.getState().render.camera };
    });
    assert.ok(before.car, 'L9 APC is active');
    for (const zoom of [1, 1.5]) {
      await session.page.evaluate(z => window.__SS__!.camera.zoom(z), zoom);
      await capture(`L9 ${tier} zoom ${zoom}`);
    }
    await key('ArrowUp', 60); await key('ArrowLeft', 30); await key('ArrowRight', 30);
    const after = await session.page.evaluate(id => ({ car: window.__SS__!.getEntity(id), input: window.__SS__!.getState().input }), before.car.id);
    evidence.push({ level: 'L9', tier, before, after });
    assert.ok(Math.hypot(after.car!.transform.x - before.car.transform.x, after.car!.transform.z - before.car.transform.z) > .5, 'L9 real keyboard drive');
    await session.close(); stopServer();
  }
  writeJson(`${out}/checks.json`, { labels, evidence });
  session = new SceneSession(); await session.open();
  await session.makeSheet(cells, `${out}/review.jpg`, 400, 380);
  console.log(JSON.stringify({ vehicles: vehicles.length, l9Tiers: 2, cells: cells.length, evidence: `${out}/checks.json`, sheet: `${out}/review.jpg` }));
} finally { await session.close(); stopServer(); }
