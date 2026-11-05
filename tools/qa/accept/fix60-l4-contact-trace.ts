/** Read-only L4 cohort diagnostics using the canonical observer's birth identities. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { l4BreachApproaches, l4Emergence } from '../../../src/data/l4';
import { observeAttackStarts } from '../threat/attackStarts';
import { PathProbe, ThreatObserver } from '../threat/observer';
import { provenance } from './probe';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const campaign = preset('L4-default'); campaign.settings.quality = tier;
const identity = provenance(), samples: unknown[] = [], births: unknown[] = [], hits: unknown[] = [], deaths: unknown[] = [], attacks: unknown[] = [];
let observer: ThreatObserver;
let threat: ReturnType<ThreatObserver['finish']> | undefined;
const run = await runLevel('L4', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    observer = new ThreatObserver(world, 'L4');
    const paths = new PathProbe(), ai = world.infected!, spawn = ai.spawn.bind(ai);
    ai.spawn = (...args) => {
      const id = spawn(...args), e = world.entities.get(id);
      if (!args[3] && e?.infected) births.push({ tick: world.tick, token: observer.identity(e), id, archetype: e.archetype, at: { ...e.transform } });
      return id;
    };
    for (const type of ['combat.hit', 'combat.kill'] as const) world.events.on(type, event => {
      if (event.type !== type) return;
      const e = world.entities.get(event.targetId); if (!e?.infected) return;
      const b = e.infected;
      (type === 'combat.hit' ? hits : deaths).push({ tick: event.tick, token: observer.identity(e), source: event.sourceId, hp: e.health.current,
        at: { ...e.transform }, scripted: b.scripted && { ...b.scripted }, approach: b.breachApproach, pressure: b.pressureTarget && { ...b.pressureTarget } });
    });
    observeAttackStarts(world, (id, target, tick) => {
      const e = world.entities.get(id);
      attacks.push({ tick, token: e && observer.identity(e), id, target });
    });
    // ThreatObserver already wraps update with the exact native acceptance
    // ordering. Sample after it, including separation and the contact owner.
    const update = world.update.bind(world);
    world.update = () => {
      const before = world.tick; update();
      if (world.tick === before || world.tick % 60) return;
      const current = observer.waves.finish().filter(w => /^(war-0@|breach-)/.test(w.key) && w.observedSeconds <= (w.key === 'breach-south' ? 90 : 40));
      if (!current.length) return;
      const player = world.entities.get(1)!, tokens = new Set(current.flatMap(w => w.members));
      samples.push({ tick: world.tick, phase: world.missions!.state.l4!.phase, player: { ...player.transform },
        waves: current.map(w => ({ key: w.key, age: w.observedSeconds, spawned: w.spawned, first: w.firstAttackSeconds })),
        actors: [...tokens].map(token => {
          const id = Number(token.split('@')[0]), e = world.entities.get(id);
          // Never attach a reused pool identity's position/brain to its predecessor.
          if (!e?.infected || observer.identity(e) !== token) return { token, id, retired: true };
          const b = e.infected, brain = b.l1, origin = world.missions!.state.l4!.origin[id];
          const source = l4Emergence[origin] ?? l4BreachApproaches[origin - l4Emergence.length];
          const nav = ai.navigation.grid(e.transform), radius = e.combat!.radius;
          const from = nav.nearestCell(e.transform.x, e.transform.z, radius), to = b.scripted && nav.nearestCell(b.scripted.x, b.scripted.z, radius);
          const pathMetres = e.health.current > 0 && current.some(w => w.observedSeconds >= 18 && w.observedSeconds < 19)
            ? paths.distance(ai.infectedNav, e, player.transform) : undefined;
          return { token, id, hp: e.health.current, archetype: e.archetype, at: { ...e.transform }, origin, source,
            state: b.state, mode: brain?.mode, scripted: b.scripted && { ...b.scripted }, approach: b.breachApproach,
            pressure: b.pressureTarget && { ...b.pressureTarget }, focus: brain?.focusId, target: brain?.targetId ?? b.heardTargetId,
            goal: brain && { x: brain.goalX, z: brain.goalZ }, pathMetres, pending: !!e.pendingAdmission,
            routing: { from, to, goal: b.goal, cells: b.path.length, index: b.pathIndex, retryAt: b.pathRetryAt,
              searchPending: to !== undefined && nav.pending(from, to), budgetLeft: (ai as unknown as { budget: number }).budget } };
        }) });
    };
  },
  beforeDispose: () => { threat = observer.finish(); },
});
const out = process.env.OUT ?? 'docs/reports/fix60-b'; mkdirSync(out, { recursive: true });
const output = join(out, `L4-${tier}-birth-contact-trace.json.gz`);
writeFileSync(output, gzipSync(JSON.stringify({ ...identity, tier, method: 'Canonical native complete policy and ThreatObserver; birth-aware spawn/hit/kill/windup ledger and post-contact 1Hz samples.', run, threat, births, hits, deaths, attacks, samples })));
console.log(output, run.outcome);
