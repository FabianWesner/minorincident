/** G-22 diagnostic prefix: actual cohort clocks, targets and independent bounded paths. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { runLevel } from '../../sim-runner/levels.ts';
import { preset } from '../../../src/sim/progression/Campaign.ts';
import { stateHash } from '../../../src/sim/world/stateHash.ts';
import { WaveObserver } from '../threat/waves.ts';
import { SpawnIdentities, PathProbe } from '../threat/observer.ts';
import { observeAttackStarts } from '../threat/attackStarts.ts';
import { provenance } from './probe.ts';

const tier = process.argv[2] ?? 'low';
const passive = process.env.SWEEP_G_PASSIVE === '1';
if (!['low', 'high'].includes(tier)) throw new Error('Expected low|high');
const campaign = () => { const save = preset('L3-default'); save.settings.quality = tier; return save; };
const identity = provenance(), samples = [], attacks = [], paths = [];
let waves, observedHash, controlHash;
const run = await runLevel('L3', 'complete', 1, 90, 'auto', campaign(), undefined, 0, { quality: tier,
  passive, beforeBegin: world => {
    const ids = new SpawnIdentities(), probe = new PathProbe();
    const observer = new WaveObserver(world, 'L3', entity => ids.identity(entity));
    const spawn = world.infected.spawn.bind(world.infected);
    world.infected.spawn = (...args) => {
      const id = spawn(...args), entity = world.entities.get(id);
      if (!args[3] && entity?.infected) ids.spawn(entity);
      return id;
    };
    observeAttackStarts(world, (source, target, tick) => {
      const entity = world.entities.get(source), victim = world.entities.get(target);
      attacks.push({ tick, source, identity: entity ? ids.identity(entity) : null, target,
        targetKind: target === 1 ? 'player' : victim?.civilian?.ally ? 'officer' : victim?.civilian ? 'civilian' : victim?.archetype });
    });
    world.events.on('sim.tick', () => {
      observer.afterTick();
      const state = world.missions.state.l3, player = world.entities.get(1);
      if (!state.attackAt) return;
      const current = observer.finish();
      for (const wave of current) if ([18 * 60, 20 * 60].includes(world.tick - Math.round(wave.startSeconds * 60))) {
        const tokens = new Set(wave.members);
        const actors = world.infected.active.filter(e => e.health.current > 0 && !e.hidden && !e.pendingAdmission && tokens.has(ids.identity(e)));
        paths.push({ tick: world.tick, wave: wave.key, ageSeconds: wave.observedSeconds, player: { ...player.transform },
          admitted: wave.spawned, actors: actors.map(e => ({ id: e.id, identity: ids.identity(e), position: { ...e.transform },
            directM: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z),
            boundedPath: probe.query(world.infected.infectedNav, e, player.transform, 2.5) })) });
      }
      if (world.tick % 60) return;
      samples.push({ tick: world.tick, phase: state.phase, player: { ...player.transform },
        waves: current.map(wave => ({ key: wave.key, age: wave.observedSeconds, admitted: wave.spawned, firstAttack: wave.firstAttackSeconds })),
        actors: state.waves.filter(q => q.id).map(q => {
          const e = world.entities.get(q.id), b = e?.infected, brain = b?.l1;
          return { wave: q.wave, source: q.dir, scheduled: q.at, id: q.id, identity: e ? ids.identity(e) : null,
            at: e ? { ...e.transform } : null, hp: e?.health.current, hidden: !!e?.hidden, pending: !!e?.pendingAdmission,
            mode: brain?.mode, target: brain?.targetId ?? b?.targetId, focus: brain?.focusId,
            goal: brain ? { x: brain.goalX, z: brain.goalZ } : null, completeApproach: brain?.search.completeApproach };
        }) });
    }, 8);
    world.events.on('level.completed', () => { waves = observer.finish(); });
    world.events.on('sim.tick', () => { waves = observer.finish(); }, 9);
  }, beforeDispose: world => { observedHash = stateHash(world.getState()); },
});
const control = await runLevel('L3', 'complete', 1, 90, 'auto', campaign(), undefined, 0, { quality: tier,
  passive,
  beforeDispose: world => { controlHash = stateHash(world.getState()); } });
const result = { ...identity, tier, passive, method: 'Unchanged canonical input prefix for90sim seconds (passive flag records stationary protection): all three scheduled station waves plus at least40s after the third. No event injection or actor relocation. Actual attack starts on every target; independent2.5x path snapshots at cohort age18/20s. Exact final state compared with an unobserved90s control.',
  run, control, observedHash, controlHash, identical: observedHash === controlHash, waves, paths, attacks, samples };
const data = gzipSync(JSON.stringify(result));
const path = `${process.env.SWEEP_G_TRACE_OUT ?? 'docs/reports/sweep-g'}/G-22-L3-${tier}-trace.json.gz`; writeFileSync(path, data);
console.log(JSON.stringify({ path, sha256: createHash('sha256').update(data).digest('hex'), identical: result.identical, waves,
  paths: paths.map(p => ({ wave: p.wave, age: p.ageSeconds, admitted: p.admitted, live: p.actors.length, bounded: p.actors.filter(e => e.boundedPath).length })) }));
process.exitCode = result.identical ? 0 : 1;
