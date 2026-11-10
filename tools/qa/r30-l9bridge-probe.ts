// Native probe: restore the L9 bridge fixture and report APC pose, bus, infected near the APC.
import { decodeSave } from '../../src/sim/progression/Save';
import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { readFixture } from './fixture-io';
const f = readFixture(process.argv[2] ?? 'tests/fixtures/saves/qa/l9-at-bridge.json.br');
const d = decodeSave(JSON.stringify(f.campaign)); if (d.status !== 'ok') throw new Error('decode');
const world = await loadLevel('L9', 1, d.save);
try {
  const l9 = world.missions!.l9!, drv = l9.driving.state;
  const dump = (tag: string) => {
    const car = world.vehicles!.cars.get(l9.state.carId)!, p = world.entities.get(1)!.transform, bus = world.vehicles!.cars.get(drv.busId);
    const near = [...world.entities.iterate()].filter(e => e.infected && e.infected.state !== 'dead' && !e.hidden && Math.hypot(e.transform.x - car.entity.transform.x, e.transform.z - car.entity.transform.z) < 40).length;
    console.log(tag, JSON.stringify({ tick: world.tick, cp: world.missions!.state.checkpoint, apc: [car.entity.transform.x, car.entity.transform.z, car.entity.transform.yaw].map(v => +v.toFixed(2)), player: [p.x, p.z].map(v => +v.toFixed(1)), bus: bus && { x: +bus.entity.transform.x.toFixed(1), z: +bus.entity.transform.z.toFixed(1), yaw: +bus.entity.transform.yaw.toFixed(2), hidden: bus.entity.hidden, stopped: drv.busStoppedAt, line: drv.busLineAt }, infected40: near, lane8: l9.driving.laneClear(8), evac: drv.evacuationDone }));
  };
  dump("t0");
  const lane = () => { const car = world.vehicles!.cars.get(l9.state.carId)!, p = car.entity.transform, out: string[] = []; for (let d = 4.5; d <= 12; d++) { const x = p.x + Math.cos(p.yaw) * d, z = p.z - Math.sin(p.yaw) * d; out.push(`${d}:${world.infected!.nav.clear(x, z, 1.7) ? 'n' : 'N'}${world.solids.clear({ x, y: p.y, z }, 1.7, car.entity.id) ? 's' : 'S'}`); } console.log('  lane y', p.y.toFixed(2), out.join(' ')); };
  lane();
  { const v = world.vehicles!.cars.get(l9.state.carId)!.entity.vehicle as unknown as Record<string, unknown>; console.log('vehicle timers', JSON.stringify(Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === 'number' && Math.abs(x) > 300)))); }
  if (process.argv.includes('--drive')) {
    const bot = new LevelNineBot(world, 'road', true);
    for (let i = 0; i < 1800 && !l9.state.finished && l9.state.phase === 'driving'; i++) { const f = bot.sample(); if (process.argv.includes('--east')) f.move = { x: 1, z: 0 }; world.applyInput(f, 'keyboard'); world.update(); if (i % 120 === 0) { dump('drive' + i); const c = world.vehicles!.cars.get(l9.state.carId)!; console.log('   active', world.vehicles!.active, 'driver', c.entity.vehicle!.driver, 'speed', c.physics.speed.toFixed(2), 'braced', c.entity.vehicle!.braced, 'holding', l9.driving.holding(l9.state.carId), 'drive', JSON.stringify(f.drive), 'brake', f.brake, 'hb', f.handbrake, 'floor', c.entity.vehicle!.floor, 'scripted', c.entity.vehicle!.scripted, 'health', c.entity.health.current); } }
    dump('drive-end'); console.log('phase', l9.state.phase, 'finished', l9.state.finished);
    process.exit(0);
  }
  const kill = process.argv.includes('--die');
  world.events.on('player.respawned', () => dump('RESPAWNED'));
  for (let i = 0; i < 900; i++) {
    if (kill && i === 400) world.player!.damage(1000, world.tick, true);
    world.update(); if (i % 100 === 99) dump('t' + (i + 1));
  }
} finally { world.dispose(); }
