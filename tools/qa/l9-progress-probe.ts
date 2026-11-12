/** Native held-W route regression. Run seeds 1, 2, 3 with --check;
 * completion and <=300 active-driving ticks without 0.04% route advance are required.
 * Authored holds use ordinary combat input; no actor poses, HP or mission state are written.
 */
import { emptyInput } from '../../src/input/InputFrame';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { crossing } from '../../src/levels/L9/district';

const seed = Number(process.argv[2] ?? 1), routeId = process.argv[3] ?? 'road';
const route = crossing.routes.find(r => r.id === routeId);
if (!route) throw new Error(`Unknown route ${routeId}`);
// Intermediate straight-line targets bring the driver back to the road after a shove.
const path = route.detour.flatMap((a, i, points) => {
  const b = points[i + 1]; if (!b) return [a];
  const count = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20);
  return Array.from({ length: count }, (_, j) => [a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count] as [number, number]);
});
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const angleDelta = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const projection = (x: number, z: number) => {
  let best = 0, bestDistance = Infinity, total = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1], [bx, bz] = path[i], dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / (length * length), 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < bestDistance) { bestDistance = d; best = total + t * length; }
    total += length;
  }
  return { distance: bestDistance, along: best / total };
};
try {
  const support = new LevelNineBot(world, routeId, true);
  const l9 = world.missions!.l9!, car = world.vehicles!.cars.get(l9.state.carId)!;
  let index = 1, peak = projection(car.entity.transform.x, car.entity.transform.z).along;
  let best = peak, stalled = 0, maxStalled = 0, maxAt = 0, maxWindow: Record<string, unknown> | null = null;
  let start = 0, startProgress = best, startPosition: [number, number] = [car.entity.transform.x, car.entity.transform.z];
  for (let i = 0; i < Number(process.env.L9_PROGRESS_TICKS ?? 36000) && !l9.state.finished && world.missions!.state.phase !== 'result' && world.entities.get(1)!.health.current > 0; i++) {
    const p = car.entity.transform, [ax, az] = path[index - 1], [bx, bz] = path[index];
    const next = path[index + 1];
    let radius = 6;
    if (next) {
      const first = Math.atan2(bz - az, bx - ax), second = Math.atan2(next[1] - bz, next[0] - bx);
      const turn = Math.min(Math.PI * .75, Math.abs(angleDelta(second, first)));
      const def = car.physics.def;
      const lock = def.steering + (def.handling.highSpeedSteering - def.steering) * Math.min(1, car.physics.speed / def.topSpeed);
      radius = Math.max(radius, def.wheelbase / Math.tan(lock) * Math.tan(turn / 2) + 5);
    }
    const passed = (p.x - ax) * (bx - ax) + (p.z - az) * (bz - az) >= (bx - ax) ** 2 + (bz - az) ** 2;
    if ((Math.hypot(p.x - bx, p.z - bz) < radius || passed) && index < path.length - 1) index++;
    const [tx, tz] = path[index], want = -Math.atan2(tz - p.z, tx - p.x);
    const steer = clamp(angleDelta(want, p.yaw) * 2, -1, 1);
    if (l9.state.phase === 'driving' && !l9.driving.holding(car.entity.id)) world.applyInput({ ...emptyInput(), drive: { throttle: 1, steer }, brake: false, handbrake: false }, 'keyboard');
    else {
      const frame = support.sample();
      if (l9.state.phase === 'driving' && l9.driving.holding(car.entity.id) && !l9.driving.state.hatchOpen) frame.interact = true;
      world.applyInput(frame, 'keyboard');
    }
    world.update();
    if (world.tick === Number(process.env.L9_CONTACT_TICK ?? -1)) {
      const contacts: unknown[] = [];
      world.physics.world!.contactPairsWith(car.physics.collider, other => {
        const t = other.translation();
        contacts.push({ position: t, prop: world.props?.items.find(item => item.collider.handle === other.handle)?.assetId, obstacle: (() => { const o = world.vehicles!.obstacles.items.find(item => item.collider.handle === other.handle); return o ? { archetype:o.entity.archetype, airborne:o.airborne, dynamic:o.body?.isDynamic(), velocity:o.body?.linvel(), position:o.entity.transform } : null; })(),
          owners: world.districts?.districts.flatMap(d => d.decay.colliders.filter(c => { const a = c.aabb, f = a.navFootprint; return Math.hypot((f?.x ?? (a.min[0]+a.max[0])/2)+d.origin[0]-t.x,(f?.z ?? (a.min[2]+a.max[2])/2)+d.origin[1]-t.z)<.05; }).map(c => c.id)) });
      });
      console.log(JSON.stringify({ contactTick: world.tick, position: [p.x,p.z], yaw:p.yaw, contacts }));
    }
    const held = l9.state.phase !== 'driving' || l9.driving.holding(car.entity.id), measured = projection(p.x, p.z);
    if (held) {
      stalled = 0; best = measured.along; start = world.tick; startProgress = best; startPosition = [p.x, p.z];
    } else {
      peak = Math.max(peak, measured.along);
      if (measured.along >= best + 0.0004) { best = measured.along; stalled = 0; start = world.tick; startProgress = measured.along; startPosition = [p.x, p.z]; }
      else stalled++;
      if (stalled > maxStalled) {
        maxStalled = stalled; maxAt = world.tick;
        if (stalled >= 300) maxWindow = { start, end: world.tick, phase: l9.state.phase, held, progress: startProgress, startPosition,
          endPosition: [p.x, p.z], speed: car.physics.speed, yaw: p.yaw, throttle: world.inputFrame.drive?.throttle, steer: world.inputFrame.drive?.steer,
          nearby: [...world.entities.iterate()].filter(e => e.id !== car.entity.id && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 12 && ['vehicle', 'physics-prop', 'obstacle'].includes(e.kind)).map(e => ({ kind: e.kind, archetype: e.archetype, hp: e.health?.current, at: [e.transform.x, e.transform.z], distance: Math.hypot(e.transform.x - p.x, e.transform.z - p.z), rammed: e.destructible?.rammed, physics: (() => { const prop = world.props?.items.find(item => item.entityId === e.id); return prop ? { fixed: prop.fixed, braced: prop.braced, mass: prop.mass, velocity: prop.body.linvel() } : null; })() })) };
      }
    }
    if (i % 600 === 599) console.log(JSON.stringify({ tick: world.tick, phase: l9.state.phase, position: [p.x, p.z], speed: car.physics.speed, routeProgress: +measured.along.toFixed(4), held, stalledSeconds: +(stalled / 60).toFixed(1) }));
  }
  if (!l9.state.finished && process.env.L9_NAV_DIAG) {
    const e = world.entities.get(672)!, nav = world.infected!.nav;
    const targets = [[461.5,-15],[456.5,-15],[461.5,-17.5],[456.5,-17.5],[470.5,-17.5],[465.5,-17.5],[479.5,-17.5],[474.5,-17.5]];
    const bodyContacts: unknown[] = [];
    world.solids.sweep(e,{x:0,z:-1},2,.35,false,true, other => bodyContacts.push({id:other.id,archetype:other.archetype,hp:other.health.current,recoverAt:other.infected?.recoverAt,at:other.transform}));
    const probes = targets.map(([x,z]) => { const path = { path: [] as number[], goal:-1, pathIndex:0 }, waypoint={x:0,z:0}; return { target:[x,z], clear:nav.clear(x,z,.5), physicalSweep: world.solids.sweep(e,{x:(x-e.transform.x)/Math.hypot(x-e.transform.x,z-e.transform.z),z:(z-e.transform.z)/Math.hypot(x-e.transform.x,z-e.transform.z)},1), reachable:nav.steer(e.transform,{x,z},path,.35,waypoint,100000), waypoint, length:path.path.length }; });
    console.log(JSON.stringify({ navDiagnostic:true, source:{...e.transform}, sourceClear:nav.clear(e.transform.x,e.transform.z,.35), bodyContacts, probes }));
  }
  const result = { seed, routeId, evacuation: l9.driving.state.roster.map(id => { const e = world.entities.get(id); return { id, hp:e?.health.current, at:e?.transform, passengerOf:e?.passengerOf, phase:e?.civilian?.survivor?.mode, story:e?.civilian?.story, hidden:e?.hidden, pending:e?.pendingAdmission, route: e?.civilian ? { goal:e.civilian.goal, index:e.civilian.pathIndex, cells:e.civilian.path.slice(-6).map(cell => [world.infected!.nav.x(cell),world.infected!.nav.z(cell)]) } : null }; }), driving: { evacuationAt:l9.driving.state.evacuationAt, evacuated:l9.driving.state.evacuated, evacuating:l9.driving.state.evacuating, done:l9.driving.state.evacuationDone, spotFailures: Object.fromEntries((l9.driving as unknown as { spotFail: Map<number,number> }).spotFail), spotSkips: Object.fromEntries((l9.driving as unknown as { spotSkip: Map<number,number> }).spotSkip), truckEntering:l9.driving.state.truckEntering, hugDone:l9.driving.state.hugDone, hugSpot:l9.driving.state.hugSpot }, tick: world.tick, phase: l9.state.phase, playerHp: world.entities.get(1)!.health.current, maxNoProgressSeconds: +(maxStalled / 60).toFixed(2), maxAt, maxWindow, routeProgress: +projection(car.entity.transform.x, car.entity.transform.z).along.toFixed(4), finished: l9.state.finished };
  mkdirSync('test-results/s67-l9stuck', { recursive: true });
  writeFileSync(`test-results/s67-l9stuck/${routeId}-seed-${seed}.json`, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (process.argv.includes('--check') && (!result.finished || maxStalled > 300)) process.exitCode = 1;
} finally { world.dispose(); }
