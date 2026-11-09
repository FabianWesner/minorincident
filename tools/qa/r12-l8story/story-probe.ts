/** Full production-input L8 story audit. No cheats, invulnerability or staged boarding. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { SimPhase } from '../../../src/core/EventBus';
import { preset } from '../../../src/sim/progression/Campaign';
import { runLevel } from '../../sim-runner/levels';
import { provenance } from '../accept/probe';

const tier = process.argv[2] ?? 'high', out = process.argv[3] ?? `test-results/eg-l8-story/story-${tier}.json`;
if (tier !== 'low' && tier !== 'high') throw new Error('Usage: story-probe.ts low|high [output.json]');
const identity = provenance(), campaign = preset('L8-default'); campaign.settings.quality = tier;
const probeSha256 = createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex');
const animals: { id: number; species: string; healthy: boolean; closest: number }[] = [];
const lines: { id: string; text: string; tick: number }[] = [], bites: { id: number; source: number; tick: number; distance: number }[] = [];
const turns: { id: number; tick: number; archetype: string }[] = [], forbiddenMega: { tick: number; id: number }[] = [];
const end = { breachedAt: 0, keeperGrabbed: false, haleFallenAt: -1, driverAt: -1, departed: false, carX: 0, carZ: 0, elephantPhase: 0, alphas: 0, peak: 0, keys: [] as string[] };
let finalState: unknown;
const activity = new Map<number, { arena: string; x: number; z: number; idle: number; maxIdle: number; at: number }>();
const run = await runLevel('L8', 'complete', 1, 1200, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const mission = world.missions!; mission.prepare(); const zoo = mission.l8!;
    for (const id of zoo.state.animals) {
      const e = world.entities.get(id)!;
      animals.push({ id, species: e.civilian!.zooAnimal!, healthy: e.health.current > 0 && !e.infected && !e.infection, closest: Infinity });
    }
    world.events.on('dialogue.line', event => { if (event.type === 'dialogue.line' && event.id.startsWith('L8.')) lines.push({ id: event.id, text: event.text, tick: event.tick }); });
    world.events.on('outbreak.bite', event => {
      if (event.type !== 'outbreak.bite' || !zoo.state.animals.includes(event.targetId)) return;
      const p = world.entities.get(1)!.transform;
      bites.push({ id: event.targetId, source: event.sourceId, tick: event.tick, distance: Math.hypot(p.x - event.position.x, p.z - event.position.z) });
    });
    world.events.on('civilian.turned', event => { if (event.type === 'civilian.turned' && zoo.state.animals.includes(event.id)) turns.push({ id: event.id, tick: event.tick, archetype: world.entities.get(event.id)!.archetype }); });
    world.events.on('civilian.grabbed', event => { if (event.type === 'civilian.grabbed' && event.targetId === zoo.state.pondKeeperId) end.keeperGrabbed = true; });
    world.events.on('sim.tick', () => {
      const s = zoo.state, player = world.entities.get(1)!.transform;
      if (!mission.state.states.breached) for (const row of animals) {
        const e = world.entities.get(row.id)!; row.closest = Math.min(row.closest, Math.hypot(player.x - e.transform.x, player.z - e.transform.z));
      }
      for (const arena of s.arenas) for (const id of arena.ids) {
        const e = world.entities.get(id), b = e?.infected;
        if (!e || !b?.arenaBoss?.engaged || e.health.current <= 0 || world.entities.get(1)!.health.current <= 0) continue;
        const row = activity.get(id) ?? { arena: arena.id, x: e.transform.x, z: e.transform.z, idle: 0, maxIdle: 0, at: world.tick };
        const active = Math.hypot(e.transform.x - row.x, e.transform.z - row.z) > .002 || !!b.specialAttack || !!b.arenaBoss.traversal || (e.combat?.reaction?.until ?? 0) > world.tick;
        row.idle = active ? 0 : row.idle + Math.min(1, Math.max(0, world.tick - row.at));
        row.maxIdle = Math.max(row.maxIdle, row.idle); row.x = e.transform.x; row.z = e.transform.z; row.at = world.tick; activity.set(id, row);
      }
      end.peak = Math.max(end.peak, world.infected!.director.count);
      if (end.haleFallenAt < 0 && mission.state.states['hale-fallen']) end.haleFallenAt = world.tick;
      if (end.driverAt < 0 && world.vehicles!.active === s.carId) end.driverAt = world.tick;
      for (const actor of world.entities.iterate()) if (actor.archetype === 'infected.mega-alpha' || actor.infected?.variant === 'inf.mega-alpha') forbiddenMega.push({ tick: world.tick, id: actor.id });
    }, SimPhase.cleanup + 2);
  },
  beforeDispose: world => {
    const zoo = world.missions!.l8!, s = zoo.state, car = world.entities.get(s.carId)!;
    Object.assign(end, { breachedAt: s.breachedAt, departed: !!world.missions!.state.states.departed, carX: car.transform.x, carZ: car.transform.z, elephantPhase: s.arenas.find(a => a.id === 'elephant')?.phase ?? 0, alphas: s.alphas,
      keys: (car.vehicle!.passengers ?? []).map(seat => world.entities.get(seat.id)?.civilian?.survivor?.key ?? 'corgi') });
    finalState = { tick: world.tick, objective: world.missions!.def.steps.filter(step => world.missions!.state.steps[step.id].status === 'active').map(step => step.id), zoo: s,
      door: zoo.door(), interaction: world.vehicles!.canInteract(), activeVehicle: world.vehicles!.active, passengers: car.vehicle!.passengers?.map(passenger => ({ id: passenger.id, phase: passenger.phase })),
      bosses: s.arenas.map(a => ({ id: a.id, carrier: world.entities.get(a.carrier), actors: a.ids.map(id => world.entities.get(id)) })),
      cast: [1, s.keeperId, s.pondKeeperId, s.haleId, s.reyesId, s.animalInterceptionId, s.dogId, ...s.roster].map(id => {
        const e = world.entities.get(id); return { id, at: e?.transform, hp: e?.health.current, civilian: e?.civilian, infected: e?.infected, emerging: e?.emerging, passengerOf: e?.passengerOf };
      }) };
  },
});
const flags: string[] = [];
if ([...activity.values()].some(row => row.maxIdle > 120)) flags.push('ENGAGED_BOSS_IDLE_OVER_2S');
if (!run.completed) flags.push(`INCOMPLETE:${run.outcome}`);
if (animals.length < 8 || !['lion', 'gorilla', 'elephant', 'zebra', 'flamingo'].every(species => animals.some(row => row.species === species)) || animals.some(row => !row.healthy)) flags.push('CALM_ANIMAL_CENSUS');
if (animals.some(row => row.species !== 'monkey' && row.closest > 18)) flags.push('ANIMALS_NOT_PASSED_ON_REAL_ROUTE');
for (const id of ['nadia-path', 'nadia-lion', 'broadcast', 'hale-greeting', 'hale-breach', 'hale-dying', 'departure']) if (!lines.some(row => row.id === `L8.${id}`)) flags.push(`MISSING_LINE:${id}`);
// A death shifts checkpoint timers. Judge the observed opening against its
// actual alarm event, never the final restored breach timestamp.
const openingAlarmTick = lines.find(row => row.id === 'L8.hale-breach')?.tick;
const opening = bites.find(bite => openingAlarmTick !== undefined && bite.tick >= openingAlarmTick && animals.find(row => row.id === bite.id)?.species === 'flamingo' && bite.distance < 20 && turns.some(turn => turn.id === bite.id && turn.archetype === 'infected.flamingo' && turn.tick - bite.tick >= 150 && turn.tick - bite.tick <= 210 && turn.tick <= openingAlarmTick + 1800));
if (!opening) flags.push('MISSING_VISIBLE_SAME_ID_OPENING_TURN');
if (!end.keeperGrabbed) flags.push('MISSING_POND_KEEPER_GRAB');
if (forbiddenMega.length) flags.push('MEGA_PRESENT_IN_L8');
if (end.haleFallenAt < 0 || end.driverAt <= end.haleFallenAt) flags.push('DRIVER_NOT_LAST_AFTER_HALE');
if (!end.departed || end.elephantPhase !== 3 || end.carX <= 116 || end.carZ < 70 || end.carZ > 80) flags.push('MISSING_ELEPHANT_GATED_ESCAPE');
if (end.peak > (tier === 'low' ? 100 : 200) || end.alphas < 3 || end.alphas > 5) flags.push('POPULATION_BUDGET');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...identity, probeSha256, tier, seed: 1, flags, activity: [...activity].map(([id, row]) => ({ id, ...row })), animals, lines, bites, turns, forbiddenMega, end, run, openingAlarmTick, finalState }, null, 2) + '\n');
console.log(JSON.stringify({ tier, outcome: run.outcome, seconds: run.time, flags, output: out }));
process.exitCode = flags.length ? 1 : 0;
