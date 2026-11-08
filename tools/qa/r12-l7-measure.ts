/** Compact before/after route audit. No input injection, god mode or population changes. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { runLevel } from '../sim-runner/levels';
import { observeAttackStarts } from './threat/attackStarts';
import { isMega } from '../../src/data/megaPresentation';
import type { EntitySnapshot } from '../../src/sim/world/types';
const variant = process.argv[2] ?? 'after';
const out = 'docs/reports/r12-l7'; mkdirSync(out, { recursive: true });
const rows: unknown[] = [];
for (const tier of ['low', 'high'] as const) for (const seed of [1, 2, 3]) {
  let shots = 0, rocketKills = 0, courierAttacks = 0, groupAttacks = 0, rejected = 0, boarded = 0;
  let simultaneousDirections = 0; const attackDirections: Record<string, number> = {};
  const alphas: { hp: number; firstHit: number; kill: number; seconds: number }[] = [];
  const hitAt = new WeakMap<EntitySnapshot, number>();
  const direction = (dx: number, dz: number) => Math.abs(dx) >= Math.abs(dz) ? dx < 0 ? 'west' : 'east' : dz < 0 ? 'north' : 'south';
  const run = await runLevel('L7', 'complete', seed, 300, undefined, undefined, undefined, 0, {
    quality: tier,
    beforeBegin: w => {
      w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher') shots++; });
      w.events.on('combat.empty', e => { if (e.type === 'combat.empty' && e.reason === 'too-close') rejected++; });
      w.events.on('combat.hit', e => {
        if (e.type !== 'combat.hit' || e.sourceId !== 1) return;
        const target = w.entities.get(e.targetId);
        if (target?.archetype === 'infected.alpha' && !isMega(target) && !hitAt.has(target)) hitAt.set(target, e.tick);
      });
      w.events.on('combat.kill', e => {
        if (e.type !== 'combat.kill' || e.sourceId !== 1 || e.downed !== undefined) return;
        if (e.actionId === 'weapon.rocket-launcher' && w.entities.get(e.targetId)?.faction === 'infected') rocketKills++;
        const target = w.entities.get(e.targetId), first = target && hitAt.get(target);
        if (target?.archetype === 'infected.alpha' && first !== undefined) alphas.push({ hp: target.health.max, firstHit: first, kill: e.tick, seconds: (e.tick - first) / 60 });
      });
      observeAttackStarts(w, (sourceId, targetId) => {
        const source = w.entities.get(sourceId), target = w.entities.get(targetId);
        if (!source || !target || source.faction !== 'infected') return;
        if (targetId === 1) courierAttacks++;
        else if (w.l7Encounters!.state.roster.some(r => r.id === targetId)) groupAttacks++;
        else return;
        const sector = direction(source.transform.x - target.transform.x, source.transform.z - target.transform.z);
        attackDirections[sector] = (attackDirections[sector] ?? 0) + 1;
      });
      w.events.on('sim.tick', () => {
        if (w.tick % 60 || !w.l7Encounters!.state.started) return;
        const p = w.entities.get(1)!.transform, sectors = new Set<string>();
        for (const e of w.infected!.active) if (e.health.current > 0 && !e.hidden && !e.infected?.hidden && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < 18 && w.infected!.nav.visible(p, e.transform, 0)) sectors.add(direction(e.transform.x - p.x, e.transform.z - p.z));
        simultaneousDirections = Math.max(simultaneousDirections, sectors.size);
      });
    },
    beforeDispose: w => { boarded = w.l7Departure!.state.boarded.length; },
  });
  const row = { tier, seed, completed: run.completed, seconds: run.time, shots, rocketKills, killsPerRocket: rocketKills / Math.max(1, shots), rejected, courierAttacks, groupAttacks, courierAttacksPerMinute: courierAttacks * 60 / run.time, groupAttacksPerMinute: groupAttacks * 60 / run.time, attackDirections, simultaneousDirections, alphas, deaths: run.deaths, boarded, outcome: run.outcome, ...(run.completed ? {} : { blocker: run.blocker }) };
  rows.push(row); writeFileSync(`${out}/measure-${variant}.json`, JSON.stringify({ variant, method: 'Same native completion policy, seeds 1–3 per population tier, 300s route cap. Windup/contact attack starts; cardinal source-to-target bearings. Simultaneous approach sectors sample living visible infected within 18m at 1Hz. Alpha TTK starts at first player hit. Rates use entire route duration.', rows }, null, 2) + '\n');
  console.log(JSON.stringify(row));
}
