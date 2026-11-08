import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadLevel } from '../sim-runner/levels';
import { LevelNineBot } from '../../src/debug/bot/LevelNineBot';
import { preset } from '../../src/sim/progression/Campaign';
import { provenance } from './accept/probe';
import { stateHash } from '../../src/sim/world/stateHash';

const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(name); return i < 0 ? fallback : process.argv[i + 1]; };
const route = arg('--route', 'road'), tier = arg('--tier', 'low'), zero = process.argv.includes('--zero'), risky = process.argv.includes('--risky');
if (!['road', 'countryside', 'dry-shortcut'].includes(route) || !['low', 'high'].includes(tier)) throw new Error('Expected --route road|countryside|dry-shortcut --tier low|high');
const maxSeconds = Number(arg('--max-seconds', '600'));
if (!Number.isFinite(maxSeconds) || maxSeconds <= 0 || maxSeconds > 1200) throw new Error('Invalid tick budget');
const output = arg('--out', `test-results/eg-l9/${route}-${tier}${zero ? '-zero' : ''}${risky ? '-risky' : ''}.json`);
const save = preset('L9-default'); save.settings.quality = tier as 'low' | 'high';
const world = await loadLevel('L9', 1, save, 0, { quality: tier as 'low' | 'high' });
try {
  const l9 = world.missions!.l9!, bot = new LevelNineBot(world, route, !risky), car = world.vehicles!.cars.get(l9.state.carId)!;
  if (zero) world.vehicles!.damage(car.entity.id, car.entity.health.max);
  const signals: { tick: number; name: string; actorId?: number }[] = [], hits: unknown[] = [], samples: unknown[] = [];
  let grabs = 0, shakes = 0, playerHits = 0, peakAlive = 0, peakChunks = 0;
  world.events.on('mission.signal', e => { if (e.type === 'mission.signal' && e.name.startsWith('l9.')) signals.push({ tick: e.tick, name: e.name, actorId: e.actorId }); });
  world.events.on('vehicle.durability-hit', e => { if (e.type === 'vehicle.durability-hit') hits.push(e); });
  world.events.on('vehicle.grabbed', () => grabs++); world.events.on('vehicle.shaken', () => shakes++);
  world.events.on('player.damaged', () => playerHits++);
  const admissions: { tick: number; id: number; archetype: string; distance: number; state: string; hidden: boolean }[] = [];
  const spawn = world.infected!.spawn.bind(world.infected);
  world.infected!.spawn = (...args) => {
    const id = spawn(...args), e = world.entities.get(id)!;
    admissions.push({ tick: world.tick, id, archetype: e.archetype, distance: Math.hypot(e.transform.x - car.entity.transform.x, e.transform.z - car.entity.transform.z), state: e.infected!.state, hidden: !!(e.hidden || e.infected!.hidden) });
    return id;
  };
  const seen = new Set<number>(), firstNear: { id: number; archetype: string; state: string; distance: number }[] = [], durations: number[] = [];
  for (let i = 0; i < maxSeconds * 60 && !l9.state.finished && world.entities.get(1)!.health.current > 0; i++) {
    world.applyInput(bot.sample(), 'keyboard'); const start = performance.now(); world.update(); durations.push(performance.now() - start);
    const p = world.entities.get(1)!;
    peakAlive = Math.max(peakAlive, world.infected!.director.count); peakChunks = Math.max(peakChunks, world.chunks!.stats().resident);
    for (const e of world.infected!.active) {
      const distance = Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z);
      if (e.hidden || e.infected!.hidden || e.health.current <= 0 || e.infectionRise || distance > 45 || seen.has(e.id)) continue;
      seen.add(e.id); firstNear.push({ id: e.id, archetype: e.archetype, state: e.infected!.state, distance });
    }
    if (i % 300 === 0) samples.push({ tick: world.tick, phase: l9.state.phase, position: { ...car.entity.transform }, speed: car.physics.speed, durability: car.entity.health.current, hp: p.health.current,
      restart: l9.driving.state.restarted, evacuation: l9.driving.state.evacuated.length, gate: l9.driving.state.gateClosed, boarders: car.entity.vehicle!.attached.length,
      bus: world.entities.get(l9.driving.state.busId)?.transform, busStopped: l9.driving.state.busStoppedAt });
  }
  durations.sort((a, b) => a - b);
  const collision = world.solids.snapshot(), state = l9.state, final = world.getState();
  const result = {
    ...provenance(), route, tier, zero, risky, seed: 1, method: 'Production LevelNineBot inputs, native Rapier/AI and normal campaign state. --zero is one explicit initial damage fixture; no immortality, teleports, actor writes or objective skips.',
    completed: state.finished, seconds: world.tick / 60, hp: world.entities.get(1)!.health.current, durability: car.entity.health.current,
    peakAlive, peakChunks, grabs, shakes, playerHits, signals, hits, samples, collision, finalStateHash: stateHash(final), driving: state.driving,
    admissions: { actors: admissions, violations: admissions.filter(e => !e.hidden && (e.distance < 100 || e.state === 'idle')) },
    firstNear: { method: 'First shown native actor within a conservative 45 m radius; this is a headless proxy, not a rendered max-zoom frustum.', actors: firstNear, idle: firstNear.filter(e => e.state === 'idle') },
    cpu: { p95: durations[Math.floor(durations.length * .95)], max: durations[durations.length - 1], note: 'Shared runner diagnostic; rendering and device performance are not measured.' },
    handover: world.progression?.campaign?.crossingHandover,
  };
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ output, completed: result.completed, seconds: result.seconds, hp: result.hp, peakAlive, peakChunks, grabs, shakes, collisionFailures: collision.failures, admissionViolations: result.admissions.violations, signals, last: samples[samples.length - 1], roster: l9.driving.state.roster.map(id => { const e = world.entities.get(id)!; return { id, key: e.civilian?.survivor?.key, position: e.transform, hp: e.health.current, passengerOf: e.passengerOf }; }) }));
  if (!result.completed || collision.failures) process.exitCode = 1;
} finally { world.dispose(); }
