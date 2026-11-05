/** Read-only announced-cohort trace on the canonical L4 complete route. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { WaveObserver } from '../threat/waves';
import { observeAttackStarts } from '../threat/attackStarts';
import { provenance } from './probe';
import { PathProbe } from '../threat/observer';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const campaign = preset('L4-default'); campaign.settings.quality = tier;
const samples: unknown[] = [], attacks: unknown[] = [];
const identity = provenance();
let waves: ReturnType<WaveObserver['finish']> = [];
const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const paths = new PathProbe();
    const observer = new WaveObserver(world, 'L4', e => String(e.id));
    observeAttackStarts(world, (id, target, tick) => attacks.push({ tick, id, target }));
    world.events.on('sim.tick', () => {
      observer.afterTick();
      if (world.tick % 60) return;
      const current = observer.finish().filter(q => /^(war-0@|breach-)/.test(q.key) && q.observedSeconds <= 40);
      if (!current.length) return;
      const player = world.entities.get(1)!;
      const ids = new Set(current.flatMap(q => q.members.map(Number)));
      samples.push({ tick: world.tick, phase: world.missions!.state.l4!.phase,
        waves: current.map(q => ({ key: q.key, age: q.observedSeconds, spawned: q.spawned, first: q.firstAttackSeconds })),
        player: { ...player.transform }, actors: [...ids].map(id => {
          const e = world.entities.get(id), b = e?.infected, brain = b?.l1;
          const pathMetres = e && e.health.current > 0 && current.some(q => q.observedSeconds >= 18 && q.observedSeconds < 19)
            ? paths.distance(world.infected!.infectedNav, e, player.transform) : undefined;
          return { id, position: e ? { ...e.transform } : null, hp: e?.health.current, archetype: e?.archetype,
            mode: brain?.mode, state: b?.state, scripted: b?.scripted, breachApproach: b?.breachApproach,
            focus: brain?.focusId, target: brain?.targetId ?? b?.heardTargetId,
            goal: brain ? { x: brain.goalX, z: brain.goalZ } : null,
            origin: world.missions!.state.l4!.origin[id], path: b?.path.length, pathMetres, pending: !!e?.pendingAdmission };
        }) });
    }, 8);
    world.events.on('level.completed', () => { waves = observer.finish(); });
  },
});
const output = `${process.env.OUT ?? "docs/reports/fix59-b"}/L4-${tier}-contact-trace.json.gz`;
writeFileSync(output, gzipSync(JSON.stringify({ ...identity, tier, method: 'Read-only 1Hz actor/AI trace for 40s after native announcements; canonical complete input policy unchanged.', run, waves, attacks, samples })));
console.log(output, run.outcome);
