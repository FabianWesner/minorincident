/** Finale charge acceptance: sustained attacks, escalation, halfway breach, and unchanged cap. */
import { writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { observeAttackStarts } from './threat/attackStarts';

const rows: Record<string, unknown>[] = [];
const tiers = (process.env.S189_TIERS ?? 'high,low').split(',') as ('high' | 'low')[];
const seeds = (process.env.S189_SEEDS ?? '1,2,3').split(',').map(Number);
for (const quality of tiers) for (const seed of seeds) {
  const attacks: number[] = [], waves: { tick: number; wave: number }[] = [];
  const samples: Record<string, unknown>[] = [];
  let installed: number | undefined, released: number | undefined, breach: number | undefined;
  let capViolations = 0, megaDeadAt: number | undefined, chargeAtMegaDeath: number | undefined;
  const result = await runLevel('L10', 'complete', seed, 1800, 'auto', preset('L10-default'), undefined, 0, {
    quality,
    beforeBegin(world) {
      observeAttackStarts(world, (_source, target, tick) => { if (target === 1) attacks.push(tick); });
      world.events.on('mission.signal', event => {
        if (event.type !== 'mission.signal') return;
        if (event.name === 'cure-assault-breach') breach ??= event.tick;
        const match = /^cure-assault-wave-(\d+)$/.exec(event.name);
        if (match) waves.push({ tick: event.tick, wave: Number(match[1]), assaultTicks: world.l10Encounters?.state.assaultTicks,
          chargeTicks: world.missions?.state.counters['charge-ticks'], chargeActive: !!world.missions?.state.states['charge-active'] } as { tick: number; wave: number });
      });
      world.events.on('sim.tick', event => {
        if (event.type !== 'sim.tick') return;
        const state = world.missions!.state;
        if (state.states['cure-installed']) installed ??= world.tick;
        if (state.states['cure-released']) released ??= world.tick;
        if (world.infected!.director.count > world.infected!.director.cap) capViolations++;
        if (installed !== undefined && released === undefined && event.tick % 120 === 0) {
          const player = world.entities.get(1)!;
          const nearby = world.infected!.active.filter(e => e.infected && e.health.current > 0 &&
            (e.infected.cureRegion === 'dispersal-complex' || e.infected.pursuit)).map(e => ({
              id: e.id, type: e.archetype, state: e.infected!.state, mode: e.infected!.l1?.mode,
              d: Math.round(Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z)),
              at: [Math.round(e.transform.x), Math.round(e.transform.y), Math.round(e.transform.z)],
              serviceEntry: !!world.l10Encounters?.state.finaleEntry?.ids.includes(e.id), emerging: !!e.emerging,
              goal: e.infected!.l1?.hasGoal ? [Math.round(e.infected!.l1.goalX), Math.round(e.infected!.l1.goalZ)] : undefined,
              special: e.infected!.specialAttack?.move,
            })).sort((a, b) => a.d - b.d);
          samples.push({ tick: event.tick, chargeTicks: state.counters['charge-ticks'], player: [Math.round(player.transform.x), Math.round(player.transform.y), Math.round(player.transform.z)],
            playerHp: player.health.current, nearby: nearby.slice(0, 8), localAlive: nearby.length,
            service: (world.l10Encounters?.state.finaleEntry?.ids ?? []).map(id => { const e = world.entities.get(id); return e?.infected && e.health.current > 0 ? {
              id, at: [Math.round(e.transform.x), Math.round(e.transform.y), Math.round(e.transform.z)], state: e.infected.state, emerging: !!e.emerging,
              leg: world.l10Encounters?.state.finaleEntry?.walking?.find(w => w.id === id)?.leg,
            } : null; }).filter(Boolean).slice(-5),
            serviceSpawned: world.l10Encounters?.state.finaleEntry?.ids.length ?? 0,
            emergenceRoute: world.l10Encounters?.state.finaleEntry && { at: [world.l10Encounters.state.finaleEntry.x, world.l10Encounters.state.finaleEntry.z],
              spawn: [world.l10Encounters.state.finaleEntry.sx, world.l10Encounters.state.finaleEntry.sz], route: world.l10Encounters.state.finaleEntry.route,
              speed: world.l10Encounters.state.finaleEntry.speedMs,
              walking: world.l10Encounters.state.finaleEntry.walking?.map(w => ({ id: w.id, leg: w.leg, stall: w.stall, until: w.until })) },
            livingTotal: world.infected!.active.filter(e => e.infected && e.health.current > 0).length });
        }
        const boss = world.megaPursuit?.entity();
        if (boss?.health.current === 0 && state.states['cure-installed']) {
          megaDeadAt ??= world.tick;
          chargeAtMegaDeath ??= state.counters['charge-ticks'];
        }
      });
    },
  });
  const starts = attacks.filter(t => installed !== undefined && released !== undefined && t >= installed && t <= released);
  const duration = installed !== undefined && released !== undefined ? released - installed : 0;
  const points = installed !== undefined && released !== undefined ? [installed, ...starts, released] : [];
  const gaps = points.slice(1).map((tick, i) => (tick - points[i]) / 60);
  const worstGapIndex = gaps.indexOf(Math.max(0, ...gaps));
  const worstFrom = points[worstGapIndex], worstTo = points[worstGapIndex + 1];
  const attacksPerMinute = duration > 0 ? starts.length * 3600 / duration : 0;
  const row = { quality, seed, completed: result.completed, deaths: result.deaths, installed, released, durationSeconds: duration / 60,
    megaDeadAt, chargeAtMegaDeath, attackTimes: starts.map(tick => (tick - (installed ?? tick)) / 60),
    attacks: starts.length, attacksPerMinute, maxGapSeconds: Math.max(0, ...gaps),
    worstGap: worstGapIndex >= 0 ? { from: worstFrom / 60, to: worstTo / 60,
      samples: samples.filter(s => Number(s.tick) >= worstFrom && Number(s.tick) <= worstTo).filter(s => Number(s.tick) % 600 === 0) } : null,
    breach, waves, capViolations,
    pass: result.completed && megaDeadAt !== undefined && (chargeAtMegaDeath ?? Infinity) < 3600 && starts.length > 0 && attacksPerMinute >= 12 &&
      gaps.every(gap => gap <= 8) && breach !== undefined && waves.length >= 2 && capViolations === 0 };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const flags = rows.filter(row => !row.pass);
const out = process.env.S189_OUT ?? '/private/tmp/s189-l10finale.json';
writeFileSync(out, JSON.stringify({ rows, flags }, null, 2) + '\n');
if (flags.length) process.exitCode = 1;
