/** PO r12: real keyboard directions and small in-memory vehicle review sheet.
 * Run with E2E_SERIAL=1 SCENE_PORT=<unused port> sh tools/e2e-lock.sh node --import tsx/esm tools/qa/r12-vehicles.ts.
 * One pooled browser/context at a time; sessions close before the next opens.
 * Uses current sources via SceneSession's dev server; no production build/capture dump. */
import assert from 'node:assert/strict';
import { SceneSession, stopServer, writeJson } from '../scenelab/session';
import { vehicles } from '../../src/data/vehicles';

const out = process.env.R12_OUT ?? 'docs/reports/r12-vehicles';
const evidence: Record<string, unknown>[] = [];
const cells: { frame: number; jpeg: Buffer }[] = [];
const labels: string[] = [];
let session = new SceneSession();
async function capture(label: string): Promise<void> {
  labels.push(label); cells.push({ frame: labels.length, jpeg: await session.snapshot() });
}
async function flush(): Promise<void> {
  writeJson(`${out}/checks.json`, { labels, evidence });
  if (cells.length && session.isOpen) await session.makeSheet(cells, `${out}/review.jpg`, 400, 380);
}
async function key(code: string | string[], ticks: number): Promise<void> {
  const codes = typeof code === 'string' ? [code] : code;
  for (const c of codes) await session.page.keyboard.down(c);
  try { await session.page.evaluate(n => window.__SS__!.step(n), ticks); }
  finally { for (const c of codes) await session.page.keyboard.up(c); }
}
try {
  await session.open();
  // Every driven definition shares the same keyboard heading rule. Test physical
  // arrows and WASD while facing map north, and project the sampled intent back
  // through the live game camera rather than assuming an isometric azimuth.
  const ordered = [...vehicles].filter(d => !process.env.R12_VEHICLES || d.id === process.env.R12_VEHICLES).sort((a, b) => Number(b.id === 'vehicle.military-apc') - Number(a.id === 'vehicle.military-apc'));
  for (const def of ordered) {
    await session.load({ name: `r12-${def.id}`, ground: 'asphalt', size: 150,
      vehicles: [{ id: 'car', asset: def.id, at: [0, 0], yaw: 90 }],
      actors: [{ id: 'courier', kind: 'courier', at: [def.width / 2 + .55, -def.doorX] }],
      camera: { mode: 'game', target: [0, 0], zoom: 1 }, frames: 0 });
    await session.page.evaluate(async () => {
      const a = window.__SS__!; a.input.set({ interact: true }); await a.step(1); a.input.clear(); await a.step(60);
    });
    const driven = await session.page.evaluate(() => window.__SS__!.query({}).find(e => e.vehicle?.driver === 1)?.id);
    assert.ok(driven, `${def.id}: entered via driver door`);
    if (def.id === 'vehicle.military-apc') {
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: [0, 1, 0], radius: 9, azimuth: 45 }));
      await capture('APC finished cab close');
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'game', target: [0, 0], zoom: 1 }));
    }
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
    let state = await session.page.evaluate(id => window.__SS__!.getEntity(id)!, driven);
    assert.ok(state.vehicle!.speed > .3, `${def.id}: real keyboard moves vehicle`);
    const lateral = [];
    for (const [code, sign, ticks] of [['ArrowLeft', -1, 120], ['ArrowRight', 1, 240]] as const) {
      const from = state.transform;
      await key(code, ticks);
      const result = await session.page.evaluate(({ id, from }) => {
        const a = window.__SS__!, car = a.getEntity(id)!, p = a.input.project(from), q = a.input.project(car.transform);
        return { car, dx: q.x - p.x, input: a.getState().input };
      }, { id: driven, from });
      evidence.push({ vehicle: def.id, code, from, result });
      assert.ok(result.dx * sign > .1, `${def.id}: ${code} actual screen travel ${result.dx}`);
      lateral.push({ key: code, screenDx: result.dx }); state = result.car;
    }
    evidence.push({ vehicle: def.id, northFacingKeyboard: 'pass', speed: state.vehicle!.speed, lateral });
    await session.page.evaluate(p => window.__SCENE__!.setCamera({ mode: 'game', target: [p.x, p.z], zoom: 1 }), state.transform);
    if (def.id === 'vehicle.military-apc') {
      await session.page.evaluate(() => window.__SCENE__!.setCamera({ mode: 'close', target: [0, 1, 0], radius: 9, azimuth: 45 }));
      // Follow the actual final car position for the close review.
      await session.page.evaluate(p => window.__SCENE__!.setCamera({ mode: 'close', target: [p.x, 1, p.z], radius: 9, azimuth: 45 }), state.transform);
    }
    await capture(def.id);
    console.log(`${def.id}: keyboard pass`);
  }
  // Preserve the explicitly local E19-AC16 bicycle rule in the native L1 world.
  await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L1'); a.pause(); a.bot.stop(); a.inspect.enable(false); a.camera.follow(); a.missions.begin(); await a.step(180);
    const bike = a.query({}).find(e => e.bicycle)!; if (!bike) throw new Error('L1 bicycle missing');
    a.teleport('player', { x: bike.transform.x + .8, z: bike.transform.z });
  });
  await key('KeyE', 1); await key('KeyW', 45);
  const bikeBefore = await session.page.evaluate(() => window.__SS__!.query({}).find(e => e.bicycle)!);
  assert.ok(bikeBefore.bicycle!.mounted, 'native L1 bike mounted');
  await key(['KeyW', 'KeyD'], 30);
  const bikeAfter = await session.page.evaluate(() => window.__SS__!.query({}).find(e => e.bicycle)!);
  assert.ok(bikeAfter.bicycle!.heading > bikeBefore.bicycle!.heading, 'L1 D still steers right relative to bicycle');
  evidence.push({ level: 'L1', bikeBefore, bikeAfter, rule: 'E19-AC16 retained: local WASD, deliberate exception to car screen headings' });
  await capture('L1 bicycle E19-AC16');
  // The native L2 passenger ride owns its steering. Check its finished crew cab
  // through the normal boarding flow; independent cars were checked above.
  await session.page.evaluate(async () => {
    const a = window.__SS__!; await a.loadLevel('L2', { progression: 'L2-default' }); a.pause(); a.camera.follow(); a.missions.begin(); a.bot.start('no-axe');
    for (let i = 0; i < 120 && a.missions.state()!.l2!.phase !== 'ride'; i++) await a.step(30);
    if (a.missions.state()!.l2!.phase !== 'ride') throw new Error('L2 native boarding did not reach ride');
    await a.step(180); a.camera.zoom(1.5);
  });
  await capture('L2 native fire-engine ride');
  evidence.push({ level: 'L2', ride: await session.page.evaluate(() => window.__SS__!.missions.state()!.l2) });
  await flush(); await session.close(); stopServer();
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
    // Fixture setup moves a native wreck into the clear starting road and
    // resets the APC. The shove itself uses real device keys and normal ticks.
    const ram = await session.page.evaluate(start => {
      const g = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game;
      const w = g.world, car = w.vehicles!.cars.get(w.vehicles!.active!)!, p = car.entity.transform;
      const prop = w.props!.items.find(p => p.assetId.startsWith('veh.') && !p.fixed && !p.braced);
      if (!prop) throw new Error('L9 has no movable native vehicle prop');
      car.physics.body.setTranslation(start, true);
      car.physics.body.setRotation({ x: 0, y: 0, z: 0, w: 1 }, true);
      car.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true); car.physics.body.setAngvel({ x: 0, y: 0, z: 0 }, true); car.physics.postPhysics();
      w.props!.place(prop, { p: [p.x + 11, w.districts!.groundHeight(p.x + 11, p.z), p.z], q: [0, 0, 0, 1] }); w.props!.updateNavigation();
      return { id: prop.id, asset: prop.assetId, start: [...prop.pose.p] };
    }, before.car.transform);
    await key(['ArrowRight', 'ArrowDown'], 180);
    const ramAfter = await session.page.evaluate(id => {
      const w = (window.__SCENE__ as unknown as { game: import('../../src/Game').Game }).game.world;
      const prop = w.props!.items.find(p => p.id === id)!;
      return { position: [...prop.pose.p], awake: w.props!.items.filter(p => p.awake).length, budget: w.props!.awakeBudget, blocker: w.props!.navWalls.get(prop.entityId) };
    }, ram.id);
    const displacement = Math.hypot(ramAfter.position[0] - ram.start[0], ramAfter.position[2] - ram.start[2]);
    assert.ok(displacement > .5, `L9 native ${ram.asset} moved ${displacement}m`);
    assert.ok(ramAfter.awake <= ramAfter.budget, 'awake prop budget respected');
    evidence.push({ level: 'L9', tier, ram, ramAfter, displacement }); await capture(`L9 ${tier} native wreck ram`);
    if (tier === 'low') { await flush(); await session.close(); stopServer(); }
  }
  console.log(JSON.stringify({ vehicles: ordered.length, l9Tiers: 2, cells: cells.length, evidence: `${out}/checks.json`, sheet: `${out}/review.jpg` }));
} finally {
  try { await flush(); }
  finally { await session.close(); stopServer(); }
}
