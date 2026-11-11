// r34-l9qa: a naive keyboard driver (W held, A/D toward the next marker, never S, K tapped while boarders cling) in the pure sim.
// Reports where and for how long the APC makes no progress (> 6 s under 1 m/s with W held). Usage: [--seed 1] [--seconds 200] [--rows]
import { loadLevel } from '../../sim-runner/levels';
import { emptyInput } from '../../../src/input/InputFrame';
import { preset } from '../../../src/sim/progression/Campaign';
const arg = (n: string, f: string) => { const i = process.argv.indexOf(n); return i < 0 ? f : process.argv[i + 1]; };
const seed = Number(arg('--seed', '1')), seconds = Number(arg('--seconds', '200')), rows = process.argv.includes('--rows');
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, car = world.vehicles!.cars.get(l9.state.carId)!, s = l9.driving.state;
  let slowSince = -1, longest = 0, longestAt = '';
  for (let i = 0; i < seconds * 60 && world.entities.get(1)!.health.current > 0 && l9.state.phase === 'driving'; i++) {
    const p = car.entity.transform, input = emptyInput();
    // Goal: along the road (+x), steering toward z = 0.
    const want = -Math.atan2(0 - p.z, p.x + 60 - p.x), delta = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    input.drive = { throttle: 1, steer: Math.max(-1, Math.min(1, -delta * 2)) };
    if (car.entity.vehicle!.attached.length && world.tick % 90 < 20) input.handbrake = true;
    world.applyInput(input, 'keyboard'); world.update();
    const held = l9.driving.holding(car.entity.id);
    const slow = car.physics.speed < 1 && !held;
    if (slow && slowSince < 0) slowSince = world.tick;
    if (!slow && slowSince >= 0) { const d = (world.tick - slowSince) / 60; if (d > longest) { longest = d; longestAt = `x=${p.x.toFixed(1)} z=${p.z.toFixed(1)} t=${(slowSince / 60).toFixed(0)}`; } slowSince = -1; }
    if (rows && world.tick % 120 === 0) {
      const near = world.infected!.active.filter(e => Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 6).map(e => e.archetype.replace('infected.', '')).slice(0, 8).join(',');
      console.log(`${(world.tick / 60).toFixed(0).padStart(4)}s x=${p.x.toFixed(1)} z=${p.z.toFixed(1)} v=${car.physics.speed.toFixed(1)} apc=${car.entity.health.current.toFixed(0)} rec=${(car.entity.vehicle!.recoveringUntil ?? 0) > world.tick ? 'R' : ' '} stuck=${car.physics.stuck ? 1 : 0} thr=${car.physics.intent.throttle.toFixed(1)} brk=${car.physics.braking ? 1 : 0} hb=${car.physics.intent.handbrake ? 1 : 0} tc=${(car.physics as unknown as { travelCount: number }).travelCount} ts=${(car.physics as unknown as { travelSum: number }).travelSum.toFixed(2)} att=${car.entity.vehicle!.attached.length} stall=${(car.entity.vehicle!.impactStallUntil ?? 0) > world.tick ? 1 : 0} ${near}`);
    }
  }
  if (slowSince >= 0) { const d = (world.tick - slowSince) / 60; if (d > longest) { longest = d; longestAt = `x=${car.entity.transform.x.toFixed(1)} (still)`; } }
  console.log(JSON.stringify({ seed, tS: +(world.tick / 60).toFixed(0), x: +car.entity.transform.x.toFixed(1), apc: car.entity.health.current, longestSlowS: +longest.toFixed(1), longestAt, evacuationAt: s.evacuationAt }));
} finally { world.dispose(); }
