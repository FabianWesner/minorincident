/** Read-only L7 native combat diagnosis, portable to the R14 commit boundaries.
 * Usage: node --import tsx/esm tools/qa/r17-l7diff.ts <tag> [low|high|both] [1,2,3] [passive|mortal-passive]
 * Uses the default mortal route window; passive is the existing threat-observer policy. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../sim-runner/levels';
import { stateHash } from '../../src/sim/world/stateHash';
import { ThreatObserver } from './threat/observer';
import { observeAttackStarts } from './threat/attackStarts';
import { provenance } from './accept/probe';

const tag = process.argv[2] ?? 'candidate', selected = process.argv[3] ?? 'both';
const tiers: ('low' | 'high')[] = selected === 'low' || selected === 'high' ? [selected] : ['low', 'high'];
const seeds = (process.argv[4] ?? '1,2,3').split(',').map(Number), passive = process.argv[5] === 'passive';
const mortalPassive = process.argv[5] === 'mortal-passive';
const out = 'test-results/r17-l7diff'; mkdirSync(out, { recursive: true });
const identity = { ...provenance(), diagnosticHash: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') };
const sector = (x: number, z: number) => Math.abs(x) >= Math.abs(z) ? x < 0 ? 'west' : 'east' : z < 0 ? 'north' : 'south';
for (const tier of tiers) for (const seed of seeds) {
  let observer: ThreatObserver, observation: ReturnType<ThreatObserver['finish']> | undefined, nativeStateHash = '';
  const damage: unknown[] = [], specials: unknown[] = [], samples: unknown[] = [];
  const alphas = new Map<number, unknown>(), attackDirections: Record<string, number> = {}, damageBySource: Record<string, number> = {};
  let courierAttacks = 0, groupAttacks = 0, simultaneousDirections = 0, acceptedHits = 0, acceptedDamage = 0;
  let final: unknown;
  const run = await runLevel('L7', 'complete', seed, undefined, 'auto', undefined, undefined, 0, {
    quality: tier, passive,
    beforeBegin: w => {
      if (mortalPassive) {
        const applyInput = w.applyInput.bind(w);
        w.applyInput = (frame, scheme) => applyInput({ ...frame, mouseAttack: false, activeAttack: false, attackInPlace: false, attackTarget: undefined,
          left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false } }, scheme);
      }
      observer = new ThreatObserver(w, 'L7', { paths: false });
      observeAttackStarts(w, (sourceId, targetId, tick) => {
        const source = w.entities.get(sourceId), target = w.entities.get(targetId);
        if (!source || !target || source.faction !== 'infected') return;
        if (targetId === 1) courierAttacks++;
        else if (w.l7Encounters!.state.roster.some(r => r.id === targetId)) groupAttacks++;
        else return;
        const direction = sector(source.transform.x - target.transform.x, source.transform.z - target.transform.z);
        attackDirections[direction] = (attackDirections[direction] ?? 0) + 1;
        if (source.archetype === 'infected.alpha') specials.push({ tick, sourceId, targetId, direction, type: 'attack-start', special: source.infected?.specialAttack?.move });
      });
      w.events.on('infected.special', e => { if (e.type === 'infected.special') specials.push({ ...e }); });
      w.events.on('combat.hit', e => {
        if (e.type !== 'combat.hit' || e.targetId !== 1 || e.amount <= 0) return;
        const p = w.entities.get(1)!, source = w.entities.get(e.sourceId), key = `${source?.archetype ?? 'unknown'}/${e.actionId}`;
        acceptedHits++; acceptedDamage += e.amount; damageBySource[key] = (damageBySource[key] ?? 0) + e.amount;
        damage.push({ ...e, hp: p.health.current, velocity: { ...p.survivor!.velocity }, player: { ...p.transform },
          source: source && { id: source.id, type: source.archetype, alphaType: source.infected?.alphaType, at: { ...source.transform }, special: source.infected?.specialAttack?.move } });
      });
      w.events.on('sim.tick', () => {
        for (const e of w.infected!.active) if (e.archetype === 'infected.alpha' && !alphas.has(e.id)) alphas.set(e.id, { id: e.id, hp: e.health.max, alphaType: e.infected?.alphaType, tick: w.tick });
        if (w.tick % 60) return;
        const p = w.entities.get(1)!, sectors = new Set<string>();
        for (const e of w.infected!.active) if (e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 18 && w.infected!.nav.visible(p.transform, e.transform, 0)) sectors.add(sector(e.transform.x - p.transform.x, e.transform.z - p.transform.z));
        simultaneousDirections = Math.max(simultaneousDirections, sectors.size);
        samples.push({ tick: w.tick, player: { ...p.transform }, hp: p.health.current, support: w.districts!.groundHeight(p.transform.x, p.transform.z),
          statuses: p.combat?.statuses.map(s => ({ kind: s.kind, expires: s.expires })), sectors: [...sectors], boarded: w.l7Departure!.state.boarded.length });
        if (w.tick % 600 === 0) writeFileSync(`${out}/${tag}-${tier}-${seed}${passive ? '-passive' : ''}-progress.json`, JSON.stringify(samples.at(-1)) + '\n');
      });
    },
    beforeDispose: w => {
      observation = observer.finish(); nativeStateHash = stateHash(w.getState());
      final = { departure: w.l7Departure!.state.phase, boarded: w.l7Departure!.state.boarded.length, arrivals: w.l7Encounters!.state.arrivals, collision: w.solids.snapshot() };
    },
  });
  const summary = { tag, tier, seed, passive, mortalPassive, completed: run.completed, outcome: run.outcome, seconds: run.time, deaths: run.deaths,
    acceptedHits, acceptedDamage, damageBySource, courierAttacks, groupAttacks,
    courierAttacksPerMinute: courierAttacks * 60 / run.time, groupAttacksPerMinute: groupAttacks * 60 / run.time,
    attackDirections, simultaneousDirections, alphas: [...alphas.values()], nativeStateHash };
  const name = `${out}/${tag}-${tier}-${seed}${passive ? '-passive' : ''}`;
  writeFileSync(`${name}.json`, JSON.stringify({ ...identity, generatedAt: new Date().toISOString(), summary, run, observation, final }, null, 2) + '\n');
  writeFileSync(`${name}-trace.json.gz`, gzipSync(JSON.stringify({ damage, specials, samples })));
  console.log(JSON.stringify(summary));
}
