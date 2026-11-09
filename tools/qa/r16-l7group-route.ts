/** L7 diagnosis using the ordinary mortal completion route and read-only observations.
 * Usage: node --import tsx/esm tools/qa/r16-l7group-route.ts <low|high> <tag> [1,2,3]
 * No setup edits, cheats, policy overrides or changed qualification thresholds. */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
import { stateHash } from '../../src/sim/world/stateHash';
import { ThreatObserver, followerPaceChecks } from './threat/observer';
import { followerPaceVerdict, type FollowerPaceSeed } from './threat/followerPace';
import { provenance } from './accept/probe';

const tier = process.argv[2] === 'high' ? 'high' : 'low', tag = process.argv[3] ?? 'lane';
const seeds = (process.argv[4] ?? '1,2,3').split(',').map(Number);
const out = 'test-results/r16-l7group'; mkdirSync(out, { recursive: true });
const identity = { ...provenance(), toolHash: createHash('sha256').update(readFileSync(new URL(import.meta.url))).digest('hex') };
const votes: FollowerPaceSeed[] = [];
for (const seed of seeds) {
  const campaign = preset('L7-default'); campaign.seed = seed; campaign.settings.quality = tier;
  let observer: ThreatObserver | undefined, observation: ReturnType<ThreatObserver['finish']> | undefined;
  let nativeStateHash = '', collision: unknown, final: unknown;
  const samples: unknown[] = [], damage: unknown[] = [], signals: unknown[] = [], shots: unknown[] = [], hits: unknown[] = [];
  const run = await runLevel('L7', 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
    quality: tier,
    beforeBegin: w => {
      observer = new ThreatObserver(w, 'L7', { paths: false });
      w.events.on('combat.hit', e => {
        if (e.type !== 'combat.hit') return;
        if (e.sourceId === 1) { const target = w.entities.get(e.targetId); hits.push({ ...e, target: target?.archetype, faction: target?.faction }); }
        if (e.targetId !== 1) return;
        const target = w.entities.get(1)!, source = w.entities.get(e.sourceId);
        damage.push({ ...e, player: { ...target.transform }, hp: target.health.current, source: source && { id: source.id, type: source.archetype, at: { ...source.transform } } });
      });
      w.events.on('combat.attack', e => { if (e.type === 'combat.attack' && e.sourceId === 1) shots.push({ ...e }); });
      w.events.on('combat.empty', e => { if (e.type === 'combat.empty' && e.sourceId === 1) shots.push({ ...e }); });
      w.events.on('mission.signal', e => { if (e.type === 'mission.signal') signals.push({ ...e }); });
      const update = w.update.bind(w);
      w.update = (...args: Parameters<typeof w.update>) => {
        update(...args);
        if (w.tick % 30) return;
        const p = w.entities.get(1)!, blocker = w.solids.blockingBody(1);
        samples.push({ tick: w.tick, player: { ...p.transform }, hp: p.health.current, speed: p.motion?.speed,
          weapon: w.combat!.runner.loadout.current('RIGHT').id, ready: { ...w.combat!.runner.gunReady },
          move: { ...w.inputFrame.move }, blocker: blocker && { id: blocker.id, type: blocker.archetype },
          steps: Object.entries(w.missions!.state.steps).filter(([, s]) => s.status === 'active').map(([id]) => id),
          bus: w.l7Departure!.state.phase, boarded: w.l7Departure!.state.boarded.length,
          followers: w.l7Encounters!.state.roster.map(r => { const e = w.entities.get(r.id)!; return { id: r.id, status: r.status, hp: e.health.current, at: { ...e.transform }, speed: e.motion?.speed, hidden: e.hidden, passengerOf: e.passengerOf, blockedBy: w.solids.blockingBody(e.id)?.id }; }),
          threats: w.infected!.active.filter(e => e.health.current > 0 && !e.hidden && Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 20).map(e => ({ id: e.id, type: e.archetype, hp: e.health.current, at: { ...e.transform }, state: e.infected?.state })),
        });
      };
    },
    beforeDispose: w => {
      observation = observer!.finish(); nativeStateHash = stateHash(w.getState()); collision = w.solids.snapshot();
      final = { departure: w.l7Departure!.state, roster: w.l7Encounters!.state.roster };
      votes.push({ seed, valid: w.l7Departure!.state.phase === 'done', companions: [...w.entities.iterate()].filter(e => e.companion).map(e => e.id), phases: observation.phases, nativeStateHash });
    },
  });
  const vote = votes.at(-1)!; vote.valid = run.completed; vote.outcome = run.outcome; vote.time = run.time;
  const receipt = { ...identity, tag, tier, seed, generatedAt: new Date().toISOString(), run, nativeStateHash, collision, final, observation, signals, damage, shots, hits };
  writeFileSync(`${out}/${tag}-${tier}-${seed}.json`, JSON.stringify(receipt, null, 2) + '\n');
  writeFileSync(`${out}/${tag}-${tier}-${seed}-trace.json.gz`, gzipSync(JSON.stringify(samples)));
  console.log(JSON.stringify({ tag, tier, seed, outcome: run.outcome, time: run.time, damage: damage.length, waitPercent: observation?.followerWait?.upperBoundPercent, nativeStateHash }));
}
const pace = followerPaceVerdict(votes, { required: followerPaceChecks.L7 });
writeFileSync(`${out}/${tag}-${tier}-pace.json`, JSON.stringify({ ...identity, tag, tier, votes, pace }, null, 2) + '\n');
console.log(JSON.stringify({ tag, tier, flags: pace.flags }));
