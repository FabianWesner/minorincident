// r32-l9fun: L9 beat timeline per route. Production LevelNineBot inputs on the native sim; no writes.
// A "beat" is something the driver has to react to: a mission signal (set piece, jump, tanker, bus, stall...),
// a fresh infected arrival within 30 m of the APC (arrivals within 4 s form one beat), a boarder grab, or a durability hit
// after 3 s without one. Gaps are measured while the APC is free to drive (not in the rail stall or evacuation hold).
// Usage: node --import tsx/esm tools/qa/r32-l9-timeline.ts [--route road|countryside|dry-shortcut] [--risky] [--zero] [--seed 1] [--out file]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { preset } from '../../src/sim/progression/Campaign';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const route = arg('--route', 'road'), risky = process.argv.includes('--risky'), zero = process.argv.includes('--zero'), seed = Number(arg('--seed', '1'));
const out = arg('--out', `test-results/r32-l9fun/timeline-${route}${risky ? '-risky' : ''}${zero ? '-zero' : ''}-s${seed}.json`);
const world = await loadLevel('L9', seed, preset('L9-default'), 0, { quality: 'low' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, !risky), car = world.vehicles!.cars.get(l9.state.carId)!;
  if (zero) world.vehicles!.damage(car.entity.id, car.entity.health.max);
  const beats: { t: number; kind: string; detail: string }[] = [];
  const beat = (kind: string, detail: string) => beats.push({ t: +(world.tick / 60).toFixed(2), kind, detail });
  let lastHit = -1e9, lastArrival = -1e9, arrivalBeat: { detail: string } | null = null;
  const hp0 = world.entities.get(1)!.health.current;
  const damageBy: Record<string, number> = {};
  let apcDamage = 0, grabs = 0, shakes = 0;
  world.events.on('mission.signal', e => { if (e.type === 'mission.signal' && e.name.startsWith('l9.') && !e.name.startsWith('l9.route.')) beat('signal', e.name.slice(3)); });
  world.events.on('vehicle.durability-hit', e => {
    if (e.type !== 'vehicle.durability-hit') return;
    apcDamage += e.before - e.after;
    const who = world.entities.get(e.targetId);
    const key = `${e.source}:${who?.archetype ?? '?'}${who?.infected?.alphaType ? `:${who.infected.alphaType}` : ''}`;
    damageBy[key] = (damageBy[key] ?? 0) + e.before - e.after;
    if (world.tick - lastHit > 180) beat('hit', `${e.source} -${(e.before - e.after).toFixed(0)}`);
    lastHit = world.tick;
  });
  world.events.on('vehicle.grabbed', () => { grabs++; beat('grab', 'boarder on the hull'); });
  world.events.on('vehicle.shaken', () => shakes++);
  const seen = new Set<number>(), holdTicks: [number, number][] = [], track: number[][] = [];
  let durabilityAtEvac = -1;
  let holdStart: number | null = null, driveStart: number | null = null, driveEnd: number | null = null;
  for (let i = 0; i < 600 * 60 && world.missions!.state.phase !== 'progression' && world.missions!.state.phase !== 'result' && world.entities.get(1)!.health.current > 0; i++) {
    world.applyInput(bot.sample(), 'keyboard'); world.update();
    const driving = l9.state.phase === 'driving', p = car.entity.transform;
    if (driving && driveStart === null && car.physics.speed > 1) driveStart = world.tick;
    if (driving && l9.driving.state.evacuationAt !== null && driveEnd === null) { driveEnd = world.tick; durabilityAtEvac = car.entity.health.current; }
    if (world.tick % 300 === 0) track.push([world.tick / 60, Math.round(p.x), Math.round(p.z), +car.physics.speed.toFixed(1), Math.round(car.entity.health.current), car.entity.vehicle!.attached.length]);
    const hold = driving && l9.driving.holding(car.entity.id);
    if (hold && holdStart === null) holdStart = world.tick;
    if (!hold && holdStart !== null) { holdTicks.push([holdStart, world.tick]); holdStart = null; }
    for (const e of world.infected!.active) {
      if (seen.has(e.id) || e.hidden || e.infected!.hidden || e.health.current <= 0) continue;
      if (Math.hypot(e.transform.x - p.x, e.transform.z - p.z) > 30) continue;
      seen.add(e.id);
      if (world.tick - lastArrival > 240 || !arrivalBeat) { beat('arrival', e.archetype + (e.infected!.alphaType ? `:${e.infected!.alphaType}` : '')); arrivalBeat = beats[beats.length - 1]; }
      else arrivalBeat.detail += `,${e.archetype.replace('infected.', '')}${e.infected!.alphaType ? `:${e.infected!.alphaType}` : ''}`;
      lastArrival = world.tick;
    }
  }
  if (holdStart !== null) holdTicks.push([holdStart, world.tick]);
  const start = (driveStart ?? 0) / 60, end = (driveEnd ?? world.tick) / 60;
  const held = (t: number) => holdTicks.some(([a, b]) => t >= a / 60 && t <= b / 60);
  // All beats, and "action" beats only (no plain arrivals: a pack walking into the headlights is not a set piece).
  const gapsOf = (list: typeof beats) => {
    const times = [start, ...list.map(b => b.t).filter(t => t > start && t < end && !held(t)), end];
    // Hold windows are fights in themselves; a gap that spans one is split at its edges.
    const marks = [...new Set([...times, ...holdTicks.flatMap(([a, b]) => [a / 60, b / 60]).filter(t => t > start && t < end)])].sort((a, b) => a - b);
    const gaps = marks.slice(1).map((t, i) => ({ from: +marks[i].toFixed(1), to: +t.toFixed(1), s: +(t - marks[i]).toFixed(1) })).filter(g => !held((g.from + g.to) / 2));
    return { maxGap: Math.max(...gaps.map(g => g.s)), meanGap: +(gaps.reduce((a, g) => a + g.s, 0) / Math.max(1, gaps.length)).toFixed(1), gapsOver20: gaps.filter(g => g.s > 20) };
  };
  const all = gapsOf(beats), action = gapsOf(beats.filter(b => b.kind !== 'arrival'));
  const result = {
    route, risky, zero, seed, completed: l9.state.finished, seconds: +(world.tick / 60).toFixed(1),
    driveWindow: [+start.toFixed(1), +end.toFixed(1)], holds: holdTicks.map(([a, b]) => [+(a / 60).toFixed(1), +(b / 60).toFixed(1)]),
    apcDamage, apcDurabilityAtEvac: durabilityAtEvac, courierHpEnd: world.entities.get(1)!.health.current, courierDamage: hp0 - world.entities.get(1)!.health.current, grabs, shakes,
    allBeats: all, actionBeats: action,
    jumps: l9.driving.state.jumped, airtime: (l9.driving.state as { airtime?: unknown }).airtime ?? null,
    setPieces: (l9.driving.state as { setPieces?: unknown }).setPieces ?? null,
    damageBy, beats, track,
  };
  mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, `${JSON.stringify(result, null, 1)}\n`);
  const summary: Record<string, unknown> = { out, ...result, beats: beats.length };
  delete summary.setPieces; delete summary.track;
  console.log(JSON.stringify(summary));
} finally { world.dispose(); }
