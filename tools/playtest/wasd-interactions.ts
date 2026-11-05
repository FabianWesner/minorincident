/** Focused interaction checks: level/checkpoint setup only, then real WASD, E/F, mouse and touch input. */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Game } from '../../src/Game';
import { SceneSession, stopServer } from '../scenelab/session';

const out = process.argv[2] ?? 'test-results/playtest/wasd-interactions';
mkdirSync(out, { recursive: true });
const session = new SceneSession({ tier: 'low', viewport: { width: 1280, height: 800 }, query: { ui: '1' } });
const rows: object[] = [];
const step = async (ticks = 1) => session.page.evaluate(n => window.__SS__!.step(n), ticks);
const press = async (key: string) => { await session.page.keyboard.press(key); await step(); };
const shot = async (name: string, evidence: object) => {
  await session.page.evaluate(() => window.__SS__!.screenshotReady());
  await session.page.screenshot({ path: `${out}/${name}.png` });
  rows.push({ name, ...evidence }); console.log(`PASS ${name}: ${JSON.stringify(evidence)}`);
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ rows, errors: session.errors }, null, 2));
};
async function load(level: 'L2' | 'L4' | 'L5' | 'L6' | 'L7') {
  await session.page.evaluate(async level => {
    const a = window.__SS__!;
    await a.loadLevel(level, { seed: 1, progression: `${level}-default` });
    a.pause(); a.missions.begin(); a.cheats.god(true); a.input.clear(); a.camera.follow();
  }, level);
}
/** Move a short final approach with real keys. Fixture placement happens before this call. */
async function approach(target: { x: number; z: number }, radius: number) {
  for (let i = 0; i < 100; i++) {
    const command = await session.page.evaluate(({ target, radius }) => {
      const g = (window.__SCENE__ as unknown as { game: Game }).game, p = g.world.entities.get(1)!.transform;
      const dx = target.x - p.x, dz = target.z - p.z, a = g.view.view.azimuth;
      const x = Math.cos(a) * dx - Math.sin(a) * dz, y = Math.sin(a) * dx + Math.cos(a) * dz;
      const d = Math.hypot(dx, dz), keys: string[] = [];
      if (d > radius) {
        if (Math.abs(x) / d > .35) keys.push(x > 0 ? 'KeyD' : 'KeyA');
        if (Math.abs(y) / d > .35) keys.push(y > 0 ? 'KeyS' : 'KeyW');
      }
      return { keys, d };
    }, { target, radius });
    if (command.d <= radius) { await step(8); return; }
    for (const key of command.keys) await session.page.keyboard.down(key);
    await step(4);
    for (const key of command.keys) await session.page.keyboard.up(key);
  }
  throw new Error(`WASD approach blocked: ${JSON.stringify(target)}`);
}
try {
  await session.open();
  await session.page.evaluate('globalThis.__name = fn => fn');
  await load('L2');
  const board = await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.missions.completeObjective('axe'); await a.step(2);
    const p = g.world.missions!.def.anchors['l2-board'];
    a.teleport(1, { x: p.x + 3, z: p.z }); await a.step(1);
    return { x: p.x, z: p.z };
  });
  await approach(board, 1.5); await press('KeyF');
  const boarded = await session.page.evaluate(() => window.__SS__!.events().some(e => e.type === 'vehicle.entered' && e.targetId === 1));
  assert(boarded, 'F boards the L2 fire engine'); await shot('l2-fire-engine', { boarded });

  // A normal driveable car retains its E/F entry and keyboard driving.
  await session.load({ name: 'wasd-vehicle-entry', ground: 'sidewalk', size: 40, actors: [{ id: 'courier', kind: 'courier', at: [0, 5] }], vehicles: [{ id: 'sedan', asset: 'vehicle.sedan', at: [0, 0] }], camera: { mode: 'follow', actor: 'courier' } });
  const car = await session.page.evaluate(async () => {
    const g = (window.__SCENE__ as unknown as { game: Game }).game, a = window.__SS__!;
    const car = [...g.world.vehicles!.cars.values()].find(c => !c.entity.vehicle!.scripted && c.entity.health.current > 0);
    if (!car) return null;
    const p = car.entity.transform, d = car.physics.def, c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const x = p.x + c * d.doorX + s * (d.width / 2 + .55), z = p.z - s * d.doorX + c * (d.width / 2 + .55);
    a.teleport(1, { x: x + s * 2.4, z: z + c * 2.4 }); await a.step(1);
    return { id: car.entity.id, x, z };
  });
  assert(car, 'fixture has a driveable vehicle door');
  await approach(car, .5); await press('KeyE');
  const driving = await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.vehicles!.active);
  assert(driving !== null, 'E enters the car'); await shot('vehicle-entry', { driving });
  await session.page.keyboard.down('KeyW'); await step(120); await session.page.keyboard.up('KeyW');
  const speed = await session.page.evaluate(() => { const w = (window.__SCENE__ as unknown as { game: Game }).game.world; return w.entities.get(w.vehicles!.active!)!.vehicle!.speed; });
  assert(speed > 1, 'W drives the car'); await press('KeyF');
  assert.equal(await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.vehicles!.active), null, 'F exits the car');
  await shot('vehicle-controls', { speed, exited: true });

  await load('L4');
  const qm = await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.missions.completeObjective('ride'); await a.step(2);
    const q = g.world.missions!.def.anchors['l4-quartermaster'];
    a.teleport(1, { x: q.x, z: q.z + 3 }); await a.step(1); return { x: q.x, z: q.z };
  });
  await approach(qm, 1.1); await press('KeyE');
  const issued = await session.page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    return { gun: w.combat!.runner.loadout.activeEntries().some(e => e.id === 'weapon.army-mg'), hmgPosts: w.missions!.state.l4!.hmgIds.length, playerMount: !!w.mountedGun };
  });
  assert(issued.gun, 'quartermaster issues machine gun'); await shot('l4-quartermaster', issued);
  // The HMG posts have no player interaction. Exercise the quartermaster's carried MG with real LMB instead.
  await session.page.mouse.move(900, 350); await session.page.mouse.down(); await step(60); await session.page.mouse.up();
  const mgShots = await session.page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.army-mg').length);
  assert(mgShots > 0, 'L4-issued machine gun fires with LMB'); await shot('l4-machine-gun', { mgShots, npcHmgPosts: issued.hmgPosts, playerMount: false });

  for (const [level, weapon] of [['L5', 'weapon.shotgun'], ['L7', 'weapon.rocket-launcher']] as const) {
    await load(level);
    const pickup = await session.page.evaluate(async weapon => {
      const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
      const e = [...g.world.entities.iterate()].find(e => e.pickup && 'actionId' in e.pickup && e.pickup.actionId === weapon)!;
      if (!e) throw new Error(`Missing pickup ${weapon}`);
      a.teleport(1, { x: e.transform.x + 3.5, z: e.transform.z }); await a.step(1);
      return { id: e.id, x: e.transform.x, z: e.transform.z };
    }, weapon);
    await approach(pickup, level === 'L5' ? 1.9 : 1.2);
    const collected = await session.page.evaluate(({ weapon, id }) => {
      const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
      return !w.entities.get(id) && w.combat!.runner.loadout.activeEntries().some(e => e.id === weapon);
    }, { weapon, id: pickup.id });
    assert(collected, `${level} auto pickup on WASD approach`); await shot(`${level.toLowerCase()}-pickup`, { weapon, collected, input: 'WASD only, no E or click' });
  }

  await load('L6');
  await session.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    a.missions.completeObjective('shelter'); a.missions.completeObjective('stop'); await a.step(2);
    const s = g.world.missions!.state.l6!; s.leaderX = 108; s.leaderZ = 15;
    for (const [i, r] of s.survivors.filter(r => r.status === 'following').entries()) a.teleport(r.id, { x: 104 + Math.floor(i / 3), z: 14 + i % 3 });
    a.teleport(1, { x: 95.5, z: 17.3 }); g.world.npcs!.companion.respawnNear(); await a.step(1);
  });
  await approach({ x: 92.4, z: 17.3 }, 1.2); await press('KeyE'); await step(90);
  const closed = await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.missions!.state.l6!.gates[0].closedAt > 0);
  assert(closed, 'E closes the L6 service gate after the group crosses'); await shot('l6-gate', { closed });

  // L4 HMG posts are NPC operated. The player mount is the shipped L10 minigun, exercised in its isolated fixture.
  await session.load({ name: 'wasd-mounted-gun', ground: 'sidewalk', size: 40, actors: [{ id: 'courier', kind: 'courier', at: [-3, 0] }], minigun: { at: [0, 0] }, camera: { mode: 'follow', actor: 'courier' } });
  await approach({ x: 0, z: 0 }, 1.2); await press('KeyE');
  const mounted = await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.mountedGun!.mounted);
  assert(mounted, 'E mounts the gun');
  const aim = await session.page.evaluate(() => window.__SS__!.input.project({ x: 3, z: 0 }, 'destination'));
  await session.page.mouse.move(Math.max(80, Math.min(1200, aim.x)), Math.max(80, Math.min(700, aim.y))); await session.page.mouse.down(); await step(120);
  await session.page.mouse.up();
  const rounds = await session.page.evaluate(() => window.__SS__!.events().filter(e => e.type === 'combat.attack' && e.actionId === 'weapon.rotary-minigun').length);
  assert(rounds > 0, 'mounted LMB fires'); await shot('mounted-gun', { mounted, rounds });
  await press('KeyF'); assert.equal(await session.page.evaluate(() => (window.__SCENE__ as unknown as { game: Game }).game.world.mountedGun!.mounted), false, 'F dismounts');
  await session.load({ name: 'wasd-companions', ground: 'sidewalk', size: 40, actors: [{ id: 'courier', kind: 'courier', at: [-3, 0], loadout: [['weapon.bat'], ['ability.corgi-lure']] }, { id: 'dog', kind: 'corgi', at: [2, 0] }], camera: { mode: 'follow', actor: 'courier' } });
  const escort = await session.page.evaluate(() => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world, id = w.npcs!.escorts.spawn({ x: 0, z: 0 });
    w.entities.get(id)!.escort!.order = 'wait'; w.entities.get(id)!.escort!.state = 'wait'; return id;
  });
  await approach({ x: 0, z: 0 }, 1.2); await step(130);
  const order = await session.page.evaluate(id => window.__SS__!.getEntity(id)!.escort!.order, escort);
  assert.equal(order, 'follow', 'WASD approach and standing changes the survivor command');
  const target = await session.page.evaluate(() => window.__SS__!.spawn('infected.runner', { x: 4, z: 1 }));
  await session.page.mouse.click(900, 350, { button: 'right' }); await step(20);
  await session.page.mouse.move(900, 350); await session.page.mouse.down(); await step(12); await session.page.mouse.up();
  const lure = await session.page.evaluate(id => {
    const w = (window.__SCENE__ as unknown as { game: Game }).game.world;
    return { effect: w.events.events().some(e => e.type === 'combat.effect' && e.actionId === 'ability.corgi-lure'), target: w.entities.get(id)?.noiseTarget?.id, dog: [...w.entities.iterate()].find(e => e.companion)?.id };
  }, target);
  assert(lure.effect && lure.target === lure.dog, 'RMB selects corgi lure and LMB attracts infected to the corgi');
  await shot('companions', { order, lure });
  assert.deepEqual(session.errors, []);
} finally { await session.close(); stopServer(); }

const phone = new SceneSession({ phone: true, tier: 'low', viewport: { width: 390, height: 844 }, query: { ui: '1' } });
try {
  await phone.open();
  await phone.page.evaluate(async () => {
    const a = window.__SS__!, g = (window.__SCENE__ as unknown as { game: Game }).game;
    await a.loadLevel('L1', { seed: 1 }); a.pause(); a.missions.begin(); g.ui.show(null); a.camera.follow();
    for (const style of document.querySelectorAll('style')) if (style.textContent?.includes('#hud:not([data-scene-hud])')) style.remove();
    await a.step(2);
  });
  await phone.page.screenshot({ path: `${out}/mobile-l1.png` });
  await phone.load({ name: 'wasd-touch-unchanged', ground: 'sidewalk', size: 30, actors: [{ id: 'courier', kind: 'courier', at: [0, 0], loadout: [['weapon.bat'], ['weapon.handgun']] }], camera: { mode: 'follow', actor: 'courier' } });
  const cdp = await phone.page.context().newCDPSession(phone.page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 80, y: 540 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 540 }] });
  await phone.page.evaluate(() => window.__SS__!.step(45));
  const moving = await phone.page.evaluate(() => window.__SS__!.getState().input.frame);
  assert(Math.hypot(moving.move.x, moving.move.z) > .9); assert.equal(moving.mouseAttack, undefined);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await phone.page.evaluate(() => window.__SS__!.step(1));
  const stopped = await phone.page.evaluate(() => window.__SS__!.getState().input.frame);
  assert.deepEqual(stopped.move, { x: 0, z: 0 });
  await phone.page.getByTestId('touch-left').tap(); await phone.page.evaluate(() => window.__SS__!.step(2));
  const attacked = await phone.page.evaluate(() => window.__SS__!.events().some(e => e.type === 'combat.attack'));
  assert(attacked, 'touch LEFT attacks on release');
  await phone.page.screenshot({ path: `${out}/mobile-touch.png` }); assert.deepEqual(phone.errors, []);
  rows.push({ name: 'mobile-touch', stickMove: moving.move, releaseMove: stopped.move, attacked });
  writeFileSync(`${out}/evidence.json`, JSON.stringify({ rows, errors: [...session.errors, ...phone.errors] }, null, 2));
  console.log('PASS mobile-touch');
} finally { await phone.close(); stopServer(); }
