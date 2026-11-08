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
const turns: { id: number; tick: number; archetype: string }[] = [], mega: { tick: number; x: number; y: number; z: number }[] = [];
const end = { breachedAt: 0, keeperGrabbed: false, megaShots: 0, haleFallenAt: -1, driverAt: -1, departed: false, carX: 0, carZ: 0, megaX: 0, megaZ: 0, alphas: 0, peak: 0, keys: [] as string[] };
let finalState: unknown;
const run = await runLevel('L8', 'complete', 1, 360, 'auto', campaign, undefined, 0, {
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
    world.events.on('ally.attack', event => { if (event.type === 'ally.attack' && event.role === 'soldier' && event.targetId === zoo.state.megaId) end.megaShots++; });
    world.events.on('sim.tick', () => {
      const s = zoo.state, player = world.entities.get(1)!.transform;
      if (!mission.state.states.breached) for (const row of animals) {
        const e = world.entities.get(row.id)!; row.closest = Math.min(row.closest, Math.hypot(player.x - e.transform.x, player.z - e.transform.z));
      }
      end.peak = Math.max(end.peak, world.infected!.director.count);
      if (end.haleFallenAt < 0 && mission.state.states['hale-fallen']) end.haleFallenAt = world.tick;
      if (end.driverAt < 0 && world.vehicles!.active === s.carId) end.driverAt = world.tick;
      const actor = world.entities.get(s.megaId);
      if (actor && (!mega.length || world.tick % 60 === 0)) mega.push({ tick: world.tick, x: actor.transform.x, y: actor.transform.y, z: actor.transform.z });
    }, SimPhase.cleanup + 2);
  },
  beforeDispose: world => {
    const zoo = world.missions!.l8!, s = zoo.state, car = world.entities.get(s.carId)!, actor = world.entities.get(s.megaId);
    Object.assign(end, { breachedAt: s.breachedAt, departed: !!world.missions!.state.states.departed, carX: car.transform.x, carZ: car.transform.z, megaX: actor?.transform.x ?? 0, megaZ: actor?.transform.z ?? 0, alphas: s.alphas,
      keys: (car.vehicle!.passengers ?? []).map(seat => world.entities.get(seat.id)?.civilian?.survivor?.key ?? 'corgi') });
    finalState = { tick: world.tick, objective: world.missions!.def.steps.filter(step => world.missions!.state.steps[step.id].status === 'active').map(step => step.id), zoo: s,
      cast: [1, s.keeperId, s.pondKeeperId, s.haleId, s.reyesId, s.animalInterceptionId, s.dogId, ...s.roster].map(id => {
        const e = world.entities.get(id); return { id, at: e?.transform, hp: e?.health.current, civilian: e?.civilian, infected: e?.infected, emerging: e?.emerging, passengerOf: e?.passengerOf };
      }) };
  },
});
const flags: string[] = [];
if (!run.completed) flags.push(`INCOMPLETE:${run.outcome}`);
if (animals.length < 8 || new Set(animals.map(row => row.species)).size !== 5 || animals.some(row => !row.healthy)) flags.push('CALM_ANIMAL_CENSUS');
if (animals.some(row => row.closest > 18)) flags.push('ANIMALS_NOT_PASSED_ON_REAL_ROUTE');
for (const id of ['nadia-path', 'nadia-lion', 'broadcast', 'hale-greeting', 'hale-breach', 'hale-dying', 'following']) if (!lines.some(row => row.id === `L8.${id}`)) flags.push(`MISSING_LINE:${id}`);
// A death shifts checkpoint timers. Judge the observed opening against its
// actual alarm event, never the final restored breach timestamp.
const openingAlarmTick = lines.find(row => row.id === 'L8.hale-breach')?.tick;
const opening = bites.find(bite => openingAlarmTick !== undefined && bite.tick >= openingAlarmTick && animals.find(row => row.id === bite.id)?.species === 'flamingo' && bite.distance < 20 && turns.some(turn => turn.id === bite.id && turn.archetype === 'infected.flamingo' && turn.tick - bite.tick >= 150 && turn.tick - bite.tick <= 210 && turn.tick <= openingAlarmTick + 1800));
if (!opening) flags.push('MISSING_VISIBLE_SAME_ID_OPENING_TURN');
if (!end.keeperGrabbed) flags.push('MISSING_POND_KEEPER_GRAB');
if (!mega.length || mega[0].z >= -86 || mega[0].y <= 4) flags.push('MISSING_NORTH_WALL_REVEAL');
if (!end.megaShots) flags.push('NO_SOLDIER_FIRE_ON_MEGA');
if (end.haleFallenAt < 0 || end.driverAt <= end.haleFallenAt) flags.push('DRIVER_NOT_LAST_AFTER_HALE');
if (!end.departed || end.carX <= 116 || end.carZ !== 80 || end.megaX <= 116 || end.carX - end.megaX > 20) flags.push('MISSING_MOVING_GATE_ESCAPE_AND_CHASE');
if (end.peak > (tier === 'low' ? 100 : 200) || end.alphas < 3 || end.alphas > 5) flags.push('POPULATION_BUDGET');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify({ ...identity, probeSha256, tier, seed: 1, flags, animals, lines, bites, turns, mega, end, run, openingAlarmTick, finalState }, null, 2) + '\n');
console.log(JSON.stringify({ tier, outcome: run.outcome, seconds: run.time, flags, output: out }));
process.exitCode = flags.length ? 1 : 0;
