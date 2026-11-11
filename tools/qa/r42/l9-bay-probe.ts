// r42-l9pin native probe: L9 from level start, production LevelNineBot to the rail crossing, then a HUD/marker driver like the
// r41 real-input run: W toward the objective marker, A/D steer, Space (handbrake) 400 of every 1500 ms while boarders ride
// (--mode hud) or W only (--mode w). No hatch shooting, no god. Reports the bay stop, survivors saved, and the post-evacuation
// pin (longest span with < 3 m net travel), recoveries and break-free relocations.
// Usage: node --import tsx/esm tools/qa/r42/l9-bay-probe.ts [--seed 1] [--mode hud|w] [--route road] [--switch-x 380] [--pile 50]
import { loadLevel } from '../../sim-runner/levels';
import { LevelNineBot } from '../../../src/debug/bot/LevelNineBot';
import { preset } from '../../../src/sim/progression/Campaign';
import { markerAnchor } from '../../../src/sim/missions/markerAnchor';
import { emptyInput } from '../../../src/input/InputFrame';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const seed = Number(arg('--seed', '1')), mode = arg('--mode', 'hud'), route = arg('--route', 'road'), switchX = Number(arg('--switch-x', '380'));
const pile = Number(arg('--pile', '0')), maxS = Number(arg('--max', '600')), verbose = process.argv.includes('--verbose');
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const m = world.missions!, l9 = m.l9!, bot = new LevelNineBot(world, route, true), car = () => world.vehicles!.cars.get(l9.state.carId)!;
  let d = l9.driving.state;
  let recoveries = 0, relocations = 0, evacPos = '', evacTick = -1, doneTick = -1, piled = false, lastRecPos = { x: 0, z: 0 };
  const deaths: string[] = [];
  world.events.on('vehicle.recovering', e => {
    if (e.type !== 'vehicle.recovering') return; recoveries++;
    const t = car().entity.transform; if (Math.hypot(t.x - lastRecPos.x, t.z - lastRecPos.z) > 5 && recoveries > 1) relocations++; lastRecPos = { x: t.x, z: t.z };
  });
  const track: [number, number, number][] = [];
  const lost = new Set<number>(), losses: { t: number; at: string; by?: string; wave: boolean }[] = [];
  let savedAtDone = -1, hud = false, endReason = 'timeout', courierDeaths = 0, dying = false, killed = false;
  for (let i = 0; i < maxS * 60; i++) {
    d = l9.driving.state; // a checkpoint restore replaces the state object
    const p = car().entity.transform;
    if (!hud && p.x > switchX) hud = true;
    let f = emptyInput();
    if (!hud || l9.state.phase !== 'driving' || (d.stallAt !== null && !d.restarted || process.argv.includes('--hatch-bot') && l9.driving.holding(car().entity.id))) f = bot.sample();
    else {
      const goal = markerAnchor(m);
      if (goal) {
        const want = -Math.atan2(goal.z - p.z, goal.x - p.x), delta = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
        f.drive = { throttle: 1, steer: delta > .06 ? 1 : delta < -.06 ? -1 : 0 }; f.brake = false;
      }
      if (mode === 'hud' && car().entity.vehicle!.attached.length && (i * 1000 / 60) % 1500 < 400) f.handbrake = true;
    }
    // Optional stress: pile N infected on the APC right after the evacuation completes (the r41 pile was 40-60).
    if ((pile || process.argv.includes('--at')) && !piled && (process.argv.includes('--early') ? p.x > 400 && Math.abs(p.z) < 60 : d.evacuationDone)) {
      piled = true; const ai = world.infected!; (ai.director as unknown as { levelCap: number }).levelCap = 2000;
      // --at x,z,yaw: set the APC where the r41 run was pinned (443.1, 6.3) before piling (the r41 pile sat on its left and rear).
      const at = arg('--at', ''); let side = [0, Math.PI * 2];
      if (at) {
        const [x, z, yaw] = at.split(',').map(Number), c = car(), y = c.physics.def.suspension + c.physics.def.wheelRadius + .15;
        Object.assign(c.entity.transform, { x, y, z, yaw }); Object.assign(c.physics.previous, c.entity.transform); c.physics.body.setTranslation({ x, y, z }, true);
        c.physics.body.setRotation({ x: 0, y: Math.sin(yaw / 2), z: 0, w: Math.cos(yaw / 2) }, true); c.physics.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
        world.spatial.set(c.entity.id, x, z); side = [yaw + Math.PI * .4, yaw + Math.PI * 1.6];
        // r41: the evacuation gate was shut (the APC came in through the side fence).
        if (process.argv.includes('--gate-closed')) { d.gateClosed = true; l9.driving.rebuild(); }
      }
      for (let k = 0; k < pile && ai.pool.length && ai.director.count + 4 < 2000; k++) {
        const a = side[0] + k / pile * (side[1] - side[0]), r = 3.5 + (k % 3);
        const id = ai.spawn(['infected.runner', 'infected.sprinter', 'infected.dog', 'infected.brute'][k % 4], { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r }, { state: 'chase' }); ai.pursueTarget(id, 1);
      }
    }
    // --kill-in-evac: the r41 courier died at the open hatch during the hold (HP 20 -> checkpoint reload at evac-point).
    if (process.argv.includes('--kill-in-evac') && !killed && d.evacuationAt !== null && world.tick - d.evacuationAt === 600) { killed = true; world.player!.damage(999, world.tick, true); }
    world.applyInput(f, 'keyboard'); world.update();
    if (d.evacuationAt !== null && evacTick < 0) { evacTick = world.tick; evacPos = `${p.x.toFixed(1)},${p.z.toFixed(1)}`; }
    // Who turns a walking survivor: seconds into the hold, where, and whether the nearest infected came with a reinforcement wave.
    if (d.evacuationAt !== null && !d.evacuationDone) for (const id of d.roster) {
      const e = world.entities.get(id); if (!e || lost.has(id) || e.passengerOf !== undefined) continue;
      if (e.health.current > 0 && !e.infected && !e.infection) continue;
      lost.add(id);
      const near = world.infected!.active.filter(z => z.id !== id && z.health.current > 0).sort((a, b) => Math.hypot(a.transform.x - e.transform.x, a.transform.z - e.transform.z) - Math.hypot(b.transform.x - e.transform.x, b.transform.z - e.transform.z))[0];
      losses.push({ t: +((world.tick - d.evacuationAt) / 60).toFixed(1), at: `${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}`, by: near?.archetype.replace('infected.', ''), wave: !!near && d.waves.includes(near.id) });
    }
    if (d.evacuationDone && doneTick < 0) { doneTick = world.tick; savedAtDone = d.evacuated.length; }
    if (doneTick > 0 && world.tick % 30 === 0) track.push([world.tick, p.x, p.z]);
    if (verbose && world.tick % 300 === 0) console.log(world.tick, p.x.toFixed(1), p.z.toFixed(1), 'v', car().physics.speed.toFixed(2), 'stuck', car().physics.stuck, 'rec', car().entity.vehicle!.recoveringUntil, 'att', car().entity.vehicle!.attached.length, 'active', world.vehicles!.active, 'driver', car().entity.vehicle!.driver, 'hold', l9.driving.holding(car().entity.id), 'stall', car().entity.vehicle!.impactStallUntil, l9.driving.text());
    if (verbose && world.tick % 600 === 0 && d.evacuationAt !== null && !d.evacuationDone) {
      const door = world.vehicles!.passengerDoor(car().entity.id);
      console.log('door', door.x.toFixed(1), door.z.toFixed(1), world.infected!.active.filter(z => z.health.current > 0 && !z.hidden && (z.attachedTo === car().entity.id || Math.hypot(z.transform.x - door.x, z.transform.z - door.z) < 8)).map(z => `${z.archetype.replace('infected.', '')}:${z.infected?.state}:${z.attachedTo === car().entity.id ? 'hull' : Math.hypot(z.transform.x - door.x, z.transform.z - door.z).toFixed(1)}:${Math.round(z.health.current)}`).join(' '), 'soldiers', d.soldiers.map(id => { const e = world.entities.get(id); return e ? `${JSON.stringify({ h: e.hidden, p: e.passengerOf, post: e.civilian?.ally?.post, role: e.civilian?.ally?.role })}${Math.round(e.health.current)}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}` : '-'; }).join(' '));
    }
    if (l9.state.phase !== 'driving') { endReason = `phase ${l9.state.phase}`; break; }
    if (world.entities.get(1)!.health.current <= 0 && !dying) { courierDeaths++; dying = true; } else if (world.entities.get(1)!.health.current > 0) dying = false;
  }
  for (const id of d.roster) { const e = world.entities.get(id); if (e && e.health.current <= 0) deaths.push(e.civilian?.survivor?.key ?? String(id)); }
  // Longest pin after the evacuation: the longest window whose net displacement stays < 3 m.
  let pin = 0;
  for (let a = 0; a < track.length; a++) for (let b = a + 1; b < track.length; b++) {
    if (Math.hypot(track[b][1] - track[a][1], track[b][2] - track[a][2]) >= 3) break;
    pin = Math.max(pin, (track[b][0] - track[a][0]) / 60);
  }
  if (verbose) for (const id of d.roster) {
    const e = world.entities.get(id); if (!e) continue;
    console.log('crew', e.civilian?.survivor?.key, Math.round(e.health.current), e.transform.x.toFixed(1), e.transform.z.toFixed(1), 'mode', e.civilian?.survivor?.mode, 'pass', e.passengerOf, 'hidden', !!e.hidden, 'evac', d.evacuated.includes(id), 'evacuating', d.evacuating.includes(id), 'sam', id === d.samId, 'path', e.civilian?.path?.length, e.civilian?.pathIndex, e.civilian?.goal, 'trucks', d.trucks.map(t => { const tr = world.entities.get(t); return tr ? `${tr.transform.x.toFixed(1)},${tr.transform.z.toFixed(1)}` : '-'; }).join(' '));
  }
  if (verbose) { const corgi = [...world.entities.iterate()].find(e => e.companion); console.log('corgi', corgi?.transform.x.toFixed(1), corgi?.transform.z.toFixed(1), 'pass', corgi?.passengerOf, 'hug', d.hugDone, JSON.stringify(d.hugSpot), 'passengers', JSON.stringify(car().entity.vehicle!.passengers)); }
  const roster = d.roster.filter(id => id !== d.samId).length;
  console.log(JSON.stringify({ seed, mode, route, evacTick, evacPos, saved: savedAtDone, losses, of: roster, dead: deaths, doneTick, toBridgeS: doneTick > 0 ? +((world.tick - doneTick) / 60).toFixed(1) : null, end: endReason, endTick: world.tick, longestPinS: +pin.toFixed(1), courierDeaths, recoveries, relocations, apc: `${car().entity.transform.x.toFixed(1)},${car().entity.transform.z.toFixed(1)}`, durability: Math.round(car().entity.health.current), near8: world.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - car().entity.transform.x, e.transform.z - car().entity.transform.z) < 8).length }));
} finally { world.dispose(); }
