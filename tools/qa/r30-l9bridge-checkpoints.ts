// Native audit of every L9 checkpoint as a retry start: the skilled bot drives L9; at each new checkpoint it is killed once, the
// retry is restored, and the restart spot is measured (lane 8 m ahead, bus / infected near, hp after 5 s without input).
//   npx tsx tools/qa/r30-l9bridge-checkpoints.ts [--route road|countryside|dry-shortcut]
import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { preset } from '../../src/sim/progression/Campaign';

const o = process.argv.indexOf('--only'), only = o < 0 ? '' : process.argv[o + 1];
const i = process.argv.indexOf('--route'), route = i < 0 ? 'road' : process.argv[i + 1];
const save = preset('L9-default'); save.settings.quality = 'low';
const world = await loadLevel('L9', 1, save, 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, true), seen = new Set<string>(), rows: unknown[] = [];
  let failed = 0;
  const car = () => world.vehicles!.cars.get(l9.state.carId)!;
  const laneDetail = () => { const c = car(), p = c.entity.transform, r = c.physics.def.width / 2 + .2, out: string[] = [];
    for (let d = c.physics.def.length / 2 + r + .5; d <= c.physics.def.length / 2 + r + 8; d += 1) { const x = p.x + Math.cos(p.yaw) * d, z = p.z - Math.sin(p.yaw) * d; const n = world.infected!.nav.clear(x, z, r), s = world.solids.clear({ x, y: p.y, z }, r, c.entity.id); if (!n || !s) out.push(`${d.toFixed(0)}${n ? '' : 'N'}${s ? '' : 'S'}`); }
    return out.join(' '); };
  const measure = (id: string, tag: string) => {
    const c = car(), p = c.entity.transform, drv = l9.driving.state, bus = world.vehicles!.cars.get(drv.busId);
    const near = (r: number) => [...world.entities.iterate()].filter(e => e.infected && e.infected.state !== 'dead' && !e.hidden && !e.corpse && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < r).length;
    return { checkpoint: id, tag, tick: world.tick, active: world.vehicles!.active, driver: c.entity.vehicle!.driver, playerHidden: world.entities.get(1)!.hidden, apc: { x: +p.x.toFixed(1), z: +p.z.toFixed(1), yaw: +p.yaw.toFixed(2) }, durability: Math.round(c.entity.health.current),
      lane8: l9.driving.laneClear(8), laneEast8: l9.driving.laneClear(8, 0), laneDetail: laneDetail(), busM: bus && !bus.entity.hidden ? +Math.hypot(bus.entity.transform.x - p.x, bus.entity.transform.z - p.z).toFixed(1) : null, infected12: near(12), infected40: near(40) };
  };
  world.events.on('checkpoint.set', e => { if (e.type === 'checkpoint.set') pending.push(e.id); });
  const pending: string[] = []; let respawned = false;
  world.events.on('player.respawned', () => { respawned = true; });
  for (let t = 0; t < 900 * 60 && !l9.state.finished && world.missions!.state.phase === 'playing'; t++) {
    world.applyInput(bot.sample(), 'keyboard'); world.update();
    const id = pending.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    rows.push(measure(id, 'live'));
    if (only && id !== only) continue;
    world.clearInput(); respawned = false; world.player!.damage(world.entities.get(1)!.health.max * 10, world.tick, true);
    for (let k = 0; k < 1500; k++) { world.update(); if (process.env.DBG && k < 8) console.log('  k', k, world.entities.get(1)!.health.current, 'active', world.vehicles!.active, 'driver', car().entity.vehicle!.driver, 'died', world.entities.get(1)!.survivor!.diedAt, world.missions!.state.phase, world.missions!.state.checkpoint); if (respawned) break; }
    if (process.env.DBG) { const pl = world.entities.get(1)!; console.log('  after respawn', { hidden: pl.hidden, passengerOf: pl.passengerOf, active: world.vehicles!.active, carId: l9.state.carId, phase: l9.state.phase, evac: l9.driving.state.evacuationDone, pos: [pl.transform.x, pl.transform.z] }); }
    const back = measure(id!, 'retry-0s');
    const hp0 = world.entities.get(1)!.health.current, d0 = car().entity.health.current;
    for (let k = 0; k < 300; k++) { world.update(); }
    const idle = { ...measure(id!, 'retry-5s-idle'), playerHp: Math.round(world.entities.get(1)!.health.current), hpAtRetry: Math.round(hp0), durabilityLost: Math.round(d0 - car().entity.health.current) };
    rows.push(back, idle);
    if (id === 'bridge' && (!back.lane8 || (back.busM !== null && back.busM < 30))) failed++;
  }
  for (const r of rows) console.log(JSON.stringify(r));
  console.log(JSON.stringify({ route, checkpointsSeen: [...seen], finished: l9.state.finished, failed }));
  process.exitCode = failed ? 1 : 0;
} finally { world.dispose(); }
