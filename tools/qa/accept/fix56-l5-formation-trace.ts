/** Record requested and resolved motion at actual formation counterexamples. */
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { stateHash } from '../../../src/sim/world/stateHash';
import { L5FormationObserver } from './l5-formation';
import { provenance } from './probe';
import { isWalkingSample, ThreatObserver } from '../threat/observer';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const campaign = preset('L5-default'); campaign.settings.quality = tier;
const samples: unknown[] = [], paceSamples: unknown[] = [];
const observer = new L5FormationObserver(), identity = provenance();
let finalHash = '';
let threat: ReturnType<ThreatObserver['finish']> | undefined;
const run = await runLevel('L5', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const threats = new ThreatObserver(world, 'L5');
    world.events.on('level.completed', () => { threat = threats.finish(); });
    const npc = world.npcs!, move = npc.move.bind(npc), requests = new Map<number, unknown>();
    npc.move = (...args) => {
      const [e, goal, speed] = args, result = move(...args);
      if (e.civilian?.survivor?.mode === 'follow') requests.set(e.id, { tick: world.tick, goal: { ...goal }, speed, result });
      return result;
    };
    const update = world.update.bind(world);
    world.update = () => {
      const player = world.entities.get(1)!, before = { ...player.transform }, tick = world.tick;
      update(); if (world.tick === tick) return;
      observer.observe(world, before);
      if (world.tick % 30 === 0 && world.missions!.state.l5?.phase === 'search' && !world.storyLock) {
        const leaderSpeed = Math.hypot(player.transform.x - before.x, player.transform.z - before.z) * 60;
        const followers = [...world.entities.iterate()].filter(e => {
          const c = e.civilian;
          if (e.id === 1 || e.hidden || e.health.current <= 0 || e.infected || !e.motion ||
              !(c?.survivor?.mode === 'follow' || e.companion?.state === 'follow') ||
              c && (['grabbed', 'bitten', 'down', 'rising', 'flee'].includes(c.state) || c.survivor?.cover || c.story?.clip === 'npc-cower')) return false;
          const lagging = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) > 6;
          return isWalkingSample(e.motion.speed, leaderSpeed, lagging, (c?.knockedUntil ?? 0) > world.tick);
        }).map(e => ({ id: e.id, speed: e.motion!.speed }));
        if (followers.length) paceSamples.push({ tick: world.tick, leaderSpeed, followers });
      }
      for (const row of observer.snapshot()) if (row.badRun > 0) {
        const e = world.entities.get(row.id)!;
        samples.push({ tick: world.tick, id: row.id, badRun: row.badRun,
          player: { ...player.transform }, velocity: { ...player.survivor!.velocity },
          follower: { ...e.transform }, motion: e.motion ? { ...e.motion, velocity: { ...e.motion.velocity } } : null,
          request: requests.get(e.id), visible: world.infected!.nav.visible(e.transform, player.transform, .35),
          state: e.civilian!.state, cover: e.civilian!.survivor!.cover });
      }
    };
  },
  beforeDispose: world => { finalHash = stateHash(world.getState()); },
});
const output = `docs/reports/fix56-b/L5-${tier}-formation-trace.json.gz`;
writeFileSync(output, gzipSync(JSON.stringify({ ...identity, tier, method: 'Read-only wrappers preserve original NPC move/update arguments and results; every actual bad straight-walk tick retained.', run, finalHash, threat, formation: observer.snapshot(), samples, paceSamples })));
console.log(output, run.outcome, samples.length);
