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
const maxSeconds = Number(process.env.P1_L7_MAX_SECONDS ?? 240);
const out = 'test-results/r17-l7diff'; mkdirSync(out, { recursive: true });
const identity = { ...provenance(), diagnosticHash: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') };
const sector = (x: number, z: number) => Math.abs(x) >= Math.abs(z) ? x < 0 ? 'west' : 'east' : z < 0 ? 'north' : 'south';
for (const tier of tiers) for (const seed of seeds) {
  let observer: ThreatObserver, observation: ReturnType<ThreatObserver['finish']> | undefined, nativeStateHash = '';
  const damage: unknown[] = [], specials: unknown[] = [], samples: unknown[] = [], followerEvents: unknown[] = [];
  const beats: { seconds: number; kind: string; detail: string }[] = [], activity: number[] = [];
  let lastFight = -1200, alphaLandedHits = 0, alphaLandedDamage = 0, rockets = 0, rocketKills = 0, gunDowns = 0, recoveries = 0, grabs = 0, minFollowerHp = Infinity;
  const alphas = new Map<number, unknown>(), attackDirections: Record<string, number> = {}, damageBySource: Record<string, number> = {};
  let courierAttacks = 0, groupAttacks = 0, alphaAttacks = 0, simultaneousDirections = 0, acceptedHits = 0, acceptedDamage = 0, boarded = 0;
  let final: unknown;
  const run = await runLevel('L7', 'complete', seed, maxSeconds, 'auto', undefined, undefined, 0, {
    quality: tier, passive,
    beforeBegin: w => {
      if (mortalPassive) {
        const applyInput = w.applyInput.bind(w);
        w.applyInput = (frame, scheme) => applyInput({ ...frame, mouseAttack: false, activeAttack: false, attackInPlace: false, attackTarget: undefined,
          left: { down: false, held: false, up: false }, right: { down: false, held: false, up: false } }, scheme);
      }
      const beat = (kind: string, detail: string) => { activity.push(w.tick); beats.push({ seconds: w.tick / 60, kind, detail }); };
      w.events.on('dialogue.line', e => { if (e.type === 'dialogue.line') beat('radio', e.id); });
      w.events.on('pickup.collected', e => { if (e.type === 'pickup.collected' && 'actionId' in e) beat('pickup', e.actionId); });
      w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1 && e.actionId === 'weapon.rocket-launcher') rockets++; });
      w.events.on('combat.kill', e => {
        if (e.type !== 'combat.kill' || !w.entities.get(e.targetId)?.infected) return;
        if (e.actionId === 'weapon.rocket-launcher' && e.downed === undefined) rocketKills++;
        if (e.downed !== undefined && (e.actionId === 'weapon.army-mg' || e.actionId === 'weapon.shotgun')) gunDowns++;
      });
      w.events.on('infected.recovered', () => { recoveries++; });
      w.events.on('civilian.state', e => { if (e.type === 'civilian.state' && e.state === 'grabbed' && w.l7Encounters!.state.roster.some(r => r.id === e.id)) grabs++; });
      observer = new ThreatObserver(w, 'L7', { paths: false });
      observeAttackStarts(w, (sourceId, targetId, tick) => {
        const source = w.entities.get(sourceId), target = w.entities.get(targetId);
        if (!source || !target || source.faction !== 'infected') return;
        if (targetId === 1) courierAttacks++;
        else if (w.l7Encounters!.state.roster.some(r => r.id === targetId)) groupAttacks++;
        else return;
        const direction = sector(source.transform.x - target.transform.x, source.transform.z - target.transform.z);
        attackDirections[direction] = (attackDirections[direction] ?? 0) + 1;
        if (source.archetype === 'infected.alpha') { alphaAttacks++; specials.push({ tick, sourceId, targetId, direction, type: 'attack-start', special: source.infected?.specialAttack?.move }); }
      });
      w.events.on('infected.special', e => { if (e.type === 'infected.special') specials.push({ ...e }); });
      w.events.on('combat.hit', e => {
        if (e.type !== 'combat.hit' || e.amount <= 0) return;
        const p = w.entities.get(1)!, a = w.entities.get(e.sourceId), b = w.entities.get(e.targetId);
        if (a?.archetype === 'infected.alpha' && b && !b.infected) { alphaLandedHits++; alphaLandedDamage += e.amount; }
        const hostile = a?.infected || b?.infected;
        if (hostile && Math.min(a ? Math.hypot(a.transform.x - p.transform.x, a.transform.z - p.transform.z) : Infinity,
          b ? Math.hypot(b.transform.x - p.transform.x, b.transform.z - p.transform.z) : Infinity) <= 30) {
          activity.push(w.tick);
          if (w.tick - lastFight >= 600) { beat('fight', `${a?.archetype}/${e.actionId} -> ${b?.archetype}`); lastFight = w.tick; }
        }
        const shooter = w.entities.get(e.sourceId), struck = w.entities.get(e.targetId);
        if (shooter?.civilian?.survivor && struck?.infected) followerEvents.push({ ...e, guardHit: true, heldId: struck.infected.l1?.biteTargetId ?? 0 });
        if (w.l7Encounters!.state.roster.some(r => r.id === e.targetId)) {
          const target = w.entities.get(e.targetId)!, source = w.entities.get(e.sourceId);
          followerEvents.push({ ...e, hp: target.health.current, target: { ...target.transform }, source: source && { type: source.archetype, at: { ...source.transform } } });
        }
        if (e.targetId !== 1) return;
        const source = w.entities.get(e.sourceId), key = `${source?.archetype ?? 'unknown'}/${e.actionId}`;
        acceptedHits++; acceptedDamage += e.amount; damageBySource[key] = (damageBySource[key] ?? 0) + e.amount;
        damage.push({ ...e, hp: p.health.current, velocity: { ...p.survivor!.velocity }, player: { ...p.transform },
          source: source && { id: source.id, type: source.archetype, alphaType: source.infected?.alphaType, at: { ...source.transform }, special: source.infected?.specialAttack?.move } });
      });
      w.events.on('infected.attack', e => { if (e.type === 'infected.attack' && e.special === 'bite' && w.l7Encounters!.state.roster.some(r => r.id === e.targetId)) followerEvents.push({ ...e }); });
      w.events.on('outbreak.bite', e => { if (e.type === 'outbreak.bite' && w.l7Encounters!.state.roster.some(r => r.id === e.targetId)) followerEvents.push({ ...e }); });
      w.events.on('mission.signal', e => { if (e.type === 'mission.signal' && /^l7.survivor-/.test(e.name)) followerEvents.push({ ...e }); });
      w.events.on('ally.attack', e => { if (e.type === 'ally.attack' && w.l7Encounters!.state.roster.some(r => r.id === e.sourceId)) followerEvents.push({ ...e }); });
      w.events.on('civilian.saved', e => { if (e.type === 'civilian.saved' && w.l7Encounters!.state.roster.some(r => r.id === e.id)) followerEvents.push({ ...e }); });
      w.events.on('sim.tick', () => {
        for (const e of w.infected!.active) if (e.archetype === 'infected.alpha' && !alphas.has(e.id)) alphas.set(e.id, { id: e.id, hp: e.health.max, alphaType: e.infected?.alphaType, tick: w.tick });
        if (w.tick % 60) return;
        for (const r of w.l7Encounters!.state.roster) {
          const e = w.entities.get(r.id); if (e) minFollowerHp = Math.min(minFollowerHp, e.health.current);
        }
        const p = w.entities.get(1)!, sectors = new Set<string>();
        for (const e of w.infected!.active) if (e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 18 && w.infected!.nav.visible(p.transform, e.transform, 0)) sectors.add(sector(e.transform.x - p.transform.x, e.transform.z - p.transform.z));
        simultaneousDirections = Math.max(simultaneousDirections, sectors.size);
        samples.push({ tick: w.tick, blockingId: w.solids.blockingBody(1)?.id, objective: Object.entries(w.missions!.state.steps).filter(([, s]) => s.status === 'active').map(([id]) => id), guards: [...w.entities.iterate()].filter(e => e.civilian?.ally?.role === 'soldier' && !w.l7Encounters!.state.roster.some(r => r.id === e.id)).map(e => ({ id: e.id, hp: e.health.current, at: { ...e.transform } })), player: { ...p.transform }, hp: p.health.current, support: w.districts!.groundHeight(p.transform.x, p.transform.z),
          statuses: p.combat?.statuses.map(s => ({ kind: s.kind, expires: s.expires })), sectors: [...sectors], boarded: w.l7Departure!.state.boarded.length,
          roster: w.l7Encounters!.state.roster.map(r => { const e = w.entities.get(r.id)!; return { id: r.id, status: r.status, hp: e.health.current, at: { ...e.transform } }; }) });
        if (w.tick % 600 === 0) writeFileSync(`${out}/${tag}-${tier}-${seed}${passive ? '-passive' : ''}-progress.json`, JSON.stringify(samples.at(-1)) + '\n');
      });
    },
    beforeDispose: w => {
      observation = observer.finish(); nativeStateHash = stateHash(w.getState());
      boarded = w.l7Departure!.state.boarded.length;
      final = { departure: w.l7Departure!.state.phase, boarded: w.l7Departure!.state.boarded.length, arrivals: w.l7Encounters!.state.arrivals, collision: w.solids.snapshot(),
        roster: w.l7Encounters!.state.roster.map(r => { const e = w.entities.get(r.id)!; return { ...r, hp: e.health.current, model: e.appearance?.asset ?? e.archetype, guard: e.civilian?.ally?.role, boarded: w.l7Departure!.state.boarded.includes(r.id) }; }),
        escaped: w.missions?.state.result?.escapedSurvivors?.map(e => e.id) ?? [] };
    },
  });
  const points = [0, ...activity.map(t => t / 60).sort((a, b) => a - b), run.time];
  let longestQuietSeconds = 0, quietFrom = 0;
  for (let i = 1; i < points.length; i++) if (points[i] - points[i - 1] > longestQuietSeconds) { longestQuietSeconds = points[i] - points[i - 1]; quietFrom = points[i - 1]; }
  const pacing = { beats, longestQuietSeconds, quietFrom, quietTo: quietFrom + longestQuietSeconds, passes: run.completed && longestQuietSeconds <= 30 };
  const summary = { tag, tier, seed, passive, mortalPassive, maxSeconds, completed: run.completed, outcome: run.outcome, seconds: run.time, deaths: run.deaths,
    acceptedHits, acceptedDamage, damageBySource, alphaLandedHits, alphaLandedDamage, rockets, rocketKills, gunDowns, recoveries, grabs, minFollowerHp, longestQuietSeconds, courierAttacks, groupAttacks, alphaAttacks, boarded,
    alphaAttacksPerMinute: alphaAttacks * 60 / run.time,
    courierAttacksPerMinute: courierAttacks * 60 / run.time, groupAttacksPerMinute: groupAttacks * 60 / run.time,
    attackDirections, simultaneousDirections, alphas: [...alphas.values()], nativeStateHash };
  const name = `${out}/${tag}-${tier}-${seed}${passive ? '-passive' : ''}`;
  writeFileSync(`${name}.json`, JSON.stringify({ ...identity, generatedAt: new Date().toISOString(), summary, pacing, run, observation, final }, null, 2) + '\n');
  writeFileSync(`${name}-trace.json.gz`, gzipSync(JSON.stringify({ damage, specials, samples, followerEvents })));
  console.log(JSON.stringify(summary));
}
