/** Native HIGH seed 3 pressure trace for the L10 finale cadence follow-up. */
import { writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { observeAttackStarts } from './threat/attackStarts';

const samples: unknown[] = [], attacks: unknown[] = [], transitions: unknown[] = [], noises: unknown[] = [];
const previousModes = new Map<number, string>();
let totalTicks = 0;
const seed = Number(process.env.S93_TRACE_SEED ?? 3), quality = (process.env.S93_TRACE_TIER ?? 'high') as 'low' | 'high';
const result = await runLevel('L10', 'complete', seed, 1800, 'auto', preset('L10-default'), undefined, 0, {
  quality,
  beforeBegin(world) {
    const ai = world.infected!, originalNoise = ai.noise.bind(ai);
    ai.noise = (position, radius, loud, sourceId) => {
      if (sourceId === 1 && world.tick >= 54_000 && world.tick <= 74_100) noises.push({ tick: world.tick,
        position, radius, loud, sourceId });
      originalNoise(position, radius, loud, sourceId);
    };
    observeAttackStarts(world, (source, target, tick) => {
      if (target === 1) attacks.push({ tick, source, archetype: world.entities.get(source)?.archetype });
    });
    world.events.on('sim.tick', event => {
      if (event.type !== 'sim.tick') return;
      const mission = world.missions!, player = world.entities.get(1)!, boss = world.megaPursuit?.entity();
      const alive = world.infected!.active.filter(e => e.health.current > 0);
      if (event.tick >= 54_000 && event.tick <= 74_100) {
        for (const e of alive) {
          const distance = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
          if (distance > 100) continue;
          const b = e.infected!, brain = b.l1;
          const signature = JSON.stringify([b.state, brain?.mode, brain?.targetId, brain?.focusId, brain?.distractionId,
            brain?.search?.until, b.investigate, e.noiseTarget, b.pressureTarget?.id, b.pressureTarget?.until]);
          if (previousModes.get(e.id) !== signature) transitions.push({ tick: event.tick, seconds: event.tick / 60, id: e.id,
            type: e.archetype, distance, state: b.state, mode: brain?.mode, target: brain?.targetId, focus: brain?.focusId,
            distraction: brain?.distractionId, goal: brain?.hasGoal ? [brain.goalX, brain.goalZ] : null,
            search: brain?.search && { until: brain.search.until, origin: [brain.search.originX, brain.search.originZ], next: brain.search.next },
            investigate: b.investigate, noiseTarget: e.noiseTarget, pressure: b.pressureTarget?.id,
            visible: world.combat!.query.visible(e.transform, player.transform),
            aheadGap: player.transform.x - e.transform.x,
            tracked: world.infected!.hearing.tracks(e, player.transform, 1),
            outpacedDrop: world.scenario === 'L10' && !!b.cureRegion && !b.pursuit && b.state === 'chase' &&
              player.transform.x - e.transform.x > world.infected!.hearing.rangeM &&
              !world.infected!.hearing.tracks(e, player.transform, 1),
            bossDistance: boss && Math.hypot(boss.transform.x - player.transform.x, boss.transform.z - player.transform.z) });
          previousModes.set(e.id, signature);
        }
      }
      if (event.tick % 300 !== 0) return;
      samples.push({ tick: event.tick, x: player.transform.x, z: player.transform.z,
        phase: mission.state.phase, step: mission.def.steps.find(step => mission.state.steps[step.id]?.status === 'active')?.id,
        cureInstalled: mission.state.states['cure-installed'], chargeActive: mission.state.states['charge-active'],
        chargeReady: mission.state.states['charge-ready'], megaDead: mission.state.states['mega-dead'],
        boss: boss && { id: boss.id, hp: boss.health.current, x: boss.transform.x, z: boss.transform.z,
          distance: Math.hypot(boss.transform.x - player.transform.x, boss.transform.z - player.transform.z),
          state: boss.infected?.state, special: boss.infected?.specialAttack?.move },
        director: { count: world.infected!.director.count, cap: world.infected!.director.cap,
          reserved: world.infected!.director.reserved, pending: world.infected!.director.pendingTurns,
          pool: world.infected!.pool.length },
        assault: { ticks: world.l10Encounters?.state.assaultTicks, wave: world.l10Encounters?.state.assaultWave,
          lastAttackAt: world.l10Encounters?.state.pressureAttackAt,
          nextAt: world.l10Encounters?.state.nextAssaultAt, spawned: Object.entries(world.l10Encounters?.state.spawned ?? {})
            .filter(([key]) => key.startsWith('dispersal-assault:')).map(([key, id]) => ({ key, id,
              alive: (world.entities.get(id)?.health.current ?? 0) > 0,
              x: world.entities.get(id)?.transform.x, z: world.entities.get(id)?.transform.z,
              state: world.entities.get(id)?.infected?.state,
              distance: world.entities.get(id) ? Math.hypot(world.entities.get(id)!.transform.x - player.transform.x,
                world.entities.get(id)!.transform.z - player.transform.z) : null })) },
        enemies: alive.map(e => ({ id: e.id, type: e.archetype, region: e.infected?.cureRegion, x: e.transform.x, z: e.transform.z,
          distance: Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z),
          state: e.infected?.state, brain: e.infected?.l1?.mode, investigate: e.infected?.investigate,
          distraction: e.infected?.l1 && { id: e.infected.l1.distractionId, target: e.infected.l1.targetId,
            goal: e.infected.l1.hasGoal ? [e.infected.l1.goalX, e.infected.l1.goalZ] : null,
            searchUntil: e.infected.l1.search.until, completeApproach: e.infected.l1.search.completeApproach },
          noiseTarget: e.noiseTarget,
          hidden: e.infected?.hidden, target: e.infected?.pressureTarget?.id })),
        counts: Object.fromEntries([...new Set(alive.map(e => e.archetype))].map(type => [type, alive.filter(e => e.archetype === type).length]))
      });
    });
  },
  beforeDispose(world) { totalTicks = world.tick; },
});
const receipt = { seed, tier: quality, completed: result.completed, deaths: result.deaths,
  totalTicks, samples, attacks, transitions, noises };
writeFileSync(process.env.S93_TRACE_OUT ?? '/private/tmp/s93-l10trace.json', JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ completed: result.completed, deaths: result.deaths, totalTicks,
  samples: samples.length, attacks: attacks.length, transitions: transitions.length, noises: noises.length,
  out: process.env.S93_TRACE_OUT ?? '/private/tmp/s93-l10trace.json' }));
