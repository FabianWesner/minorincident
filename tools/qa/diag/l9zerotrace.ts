// r27-l9apc diagnostic: the production L9 bot on the --zero fixture; logs what holds the APC between two ticks.
// Usage: npx tsx tools/qa/diag/l9zerotrace.ts [--from T] [--to T] [--every N] [--route road]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const from = Number(arg('--from', '0')), to = Number(arg('--to', '36000')), every = Number(arg('--every', '60')), route = arg('--route', 'road');
const save = preset('L9-default'); save.settings.quality = 'low';
const world = await loadLevel('L9', 1, save, 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, true), car = world.vehicles!.cars.get(l9.state.carId)!;
  if (!process.argv.includes('--healthy')) world.vehicles!.damage(car.entity.id, car.entity.health.max);
  let stallTicks = 0, holdTicks = 0, slowTicks = 0;
  for (let i = 0; i < to && world.missions!.state.phase !== 'result' && world.missions!.state.phase !== 'progression'; i++) {
    const frame = bot.sample(); world.applyInput(frame, 'keyboard'); world.update();
    const st = car.entity.vehicle!;
    if (world.tick < (st.impactStallUntil ?? 0)) stallTicks++;
    if (l9.driving.holding(car.entity.id)) holdTicks++;
    if (car.physics.speed < 1) slowTicks++;
    if (world.tick >= from && world.tick % every === 0) {
      const p = car.entity.transform, near = world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && car.physics.hullDistance(e.transform.x, e.transform.z) < 2).map(e => e.archetype.replace('infected.', '') + (e.attachedTo ? '*' : ''));
      console.log(JSON.stringify({ t: world.tick, x: +p.x.toFixed(1), z: +p.z.toFixed(1), yaw: +p.yaw.toFixed(2), v: +car.physics.speed.toFixed(2), cap: +(car.physics.speedCap * car.physics.def.topSpeed).toFixed(1),
        thr: +car.physics.intent.throttle.toFixed(2), st: +car.physics.intent.steer.toFixed(2), br: car.physics.intent.brake, hb: car.physics.intent.handbrake, move: frame.move, drive: frame.drive, fb: frame.brake, fhb: frame.handbrake,
        stall: world.tick < (st.impactStallUntil ?? 0), hold: l9.driving.holding(car.entity.id), rec: st.recoveringUntil > world.tick, stuck: car.physics.stuck, att: st.attached.length, near, roster: process.argv.includes('--roster') ? l9.driving.state.roster.map(id => { const e = world.entities.get(id)!, c = e.civilian; return { id, k: c?.survivor?.key, x: +e.transform.x.toFixed(1), z: +e.transform.z.toFixed(1), po: e.passengerOf, st: c?.state, ph: car.entity.vehicle!.passengers?.find(q => q.id === id)?.phase, path: c?.path.length, goal: c?.goal, ally: c?.ally && JSON.stringify(c.ally).slice(0, 160), pause: c?.pauseUntil, mode: c?.survivor?.mode, start: world.infected!.nav.startCell(e.transform, .35), near: world.infected!.nav.nearestCell(e.transform.x, e.transform.z, .35), reach: (() => { const r: number[] = []; const from = world.infected!.nav.startCell(e.transform, .35); return from < 0 ? 'nostart' : world.infected!.nav.reachPath(from, { x: 474.5, z: -15 }, r, 20000) + ':' + r.length; })() }; }) : undefined }));
    }
  }
  if (process.argv.includes('--walls')) {
    const ok = [...world.entities.iterate()].find(e => e.civilian?.survivor?.key === 'okafor')!, nav = world.infected!.nav;
    for (const target of [{ x: 479.5, z: -15 }, { x: 474.5, z: -15 }, { x: 461.5, z: -15 }, { x: 451, z: 0 }]) for (const budget of [1600, 100000]) {
      const route = { path: [] as number[], goal: -1, pathIndex: 0 }, wp = { x: 0, z: 0 };
      console.log('steer', JSON.stringify(target), budget, nav.steer(ok.transform, target, route, .35, wp, budget), route.path.length, JSON.stringify(wp), nav.clear(target.x, target.z, .5));
    }
    const seen = new Set<string>();
    world.infected!.nav.visitSolids(451, 8, 14, (wall, id) => { if (seen.has(id)) return; seen.add(id); console.log('wall', id, JSON.stringify(wall)); });
    for (let z = 20; z >= -20; z -= 1) { let row = ''; for (let x = 436; x <= 482; x += 1) row += world.infected!.nav.clear(x, z, .35) ? '.' : '#'; console.log(String(z).padStart(4), row); }
  }
  console.log(JSON.stringify({ end: world.tick, phase: l9.state.phase, evac: l9.driving.state.evacuated.length, stallTicks, holdTicks, slowTicks }));
} finally { world.dispose(); }
