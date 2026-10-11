/** PKG-09: real keyboard controls in Scene Lab, pinned game/close entry and exit sheets. */
import { strict as assert } from 'node:assert';
import { mkdirSync } from 'node:fs';
import { SceneSession, stopServer, writeJson } from './session';
import { vehicles } from '../../src/data/vehicles';
import type { CameraSpec } from '../../src/debug/scenelab/spec';
const phase = process.argv[2] ?? 'after';
const session = new SceneSession({ viewport: { width: 960, height: 540 } });
try {
  await session.open();
  for (const def of vehicles.filter(v => !process.argv[3] || v.id === process.argv[3])) for (const moving of [false, true]) {
    const out = `test-results/fix-car-entry/${phase}/${def.id}/${moving ? 'moving' : 'stopped'}`;
    mkdirSync(out, { recursive: true });
    const x = phase === 'before' ? .2 : def.doorX;
    await session.load({ name: def.id, ground: 'asphalt', size: 100, dof: false, actors: [{ id: 'courier', kind: 'courier', at: [x, def.width / 2 + .65], yaw: 90 }], vehicles: [{ id: 'car', asset: def.id, at: [0, 0] }], camera: { mode: 'game', target: [0, .7, 0] } });
    const cells: Record<string, { frame: number; jpeg: Buffer }[]> = { game: [], close: [] };
    const probes: unknown[] = [];
    let frame = 0;
    const step = async (n: number) => { await session.page.evaluate(n => window.__SS__!.step(n), n); frame += n; };
    const capture = async () => {
      const state = await session.page.evaluate(() => window.__SS__!.getState());
      probes.push({ frame, state });
      const car = state.entities.find(e => e.kind === 'vehicle')!;
      for (const mode of ['game', 'close'] as const) {
        const camera: CameraSpec = mode === 'game' ? { mode, target: [car.transform.x, .7, car.transform.z] } : { mode, target: [car.transform.x + .2, .9, car.transform.z], radius: 10, azimuth: 45 };
        await session.page.evaluate(camera => window.__SCENE__!.setCamera(camera), camera);
        cells[mode].push({ frame, jpeg: await session.snapshot() });
      }
    };
    await capture();
    await session.page.keyboard.down('KeyE'); await step(1); await session.page.keyboard.up('KeyE');
    for (const at of [6, 12, 24, 36, 48, 60, 75]) { await step(at - frame); await capture(); }
    await session.page.keyboard.down('KeyW'); await step(120); await session.page.keyboard.up('KeyW');
    if (!moving) {
      await session.page.keyboard.down('KeyK'); // RIGHT: the actual rear handbrake.
      for (let i = 0; i < 600; i += 30) {
        await step(30);
        if (await session.page.evaluate(() => window.__SS__!.getState().entities.find(e => e.kind === 'vehicle')!.vehicle!.speed < .1)) break;
      }
      await session.page.keyboard.up('KeyK');
    }
    const driven = await session.page.evaluate(() => window.__SS__!.getState());
    const drivenCar = driven.entities.find(e => e.kind === 'vehicle')!;
    assert(moving ? drivenCar.vehicle!.speed > 2 : drivenCar.vehicle!.speed < .1, 'real drive/stop required');
    const exitAt = frame;
    await capture();
    await session.page.keyboard.down('KeyE'); await step(1); await session.page.keyboard.up('KeyE');
    for (const at of [6, 13, 24, 36, 48, 60, 75]) { await step(exitAt + at - frame); await capture(); }
    for (const mode of ['game', 'close']) await session.makeSheet(cells[mode], `${out}/${mode}.jpg`);
    writeJson(`${out}/probes.json`, probes);
    if (phase === 'after') {
      const states = probes as { frame: number; state: ReturnType<NonNullable<Window['__SS__']>['getState']> }[];
      // JSON probes remain the evidence; assertions enforce the transition timing and real input ownership.
      const at = (f: number) => states.find(p => p.frame === f)!.state;
      assert(at(6).render.character!.visible && at(12).render.character!.visible, 'courier stays drawn while door opens');
      assert(at(12).render.vehicles.some(v => 'doors' in v && v.doors.some(d => Math.abs(d.yaw) > .5 && d.meshes > 0)), 'authored door opens');
      assert(at(60).player!.hidden && !at(60).render.character!.visible, 'simulation driver hidden after boarding');
      assert(at(exitAt + 13).render.character!.visible && !at(exitAt + 60).player!.hidden, 'step-down then on-foot control');
      assert.equal(session.errors.length, 0);
    }
    console.log(`${phase} ${def.id} ${moving ? 'moving' : 'stopped'}: ${session.errors.length} console errors`);
  }
} finally { await session.close(); stopServer(); }
