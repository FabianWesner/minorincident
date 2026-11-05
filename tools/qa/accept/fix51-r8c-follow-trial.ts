import { writeFileSync } from 'node:fs';
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { ThreatObserver } from '../threat/observer';
import { provenance } from './probe';
import { AcceptanceObserver } from './observer';
import { stateHash } from '../../../src/sim/world/stateHash';
const identity = provenance(), rows = [];
const control = process.argv.includes('--control'), acceptance = process.argv.includes('--acceptance');
for (const tier of process.argv.includes('--high') ? ['high'] as const : ['low'] as const) {
  const campaign = preset('L3-default'); campaign.settings.quality = tier;
  let observer: ThreatObserver | undefined, observation: ReturnType<ThreatObserver['finish']> | undefined;
  let squad: unknown;
  let nativeStateHash = '';
  const run = await runLevel('L3','complete',1,undefined,'auto',campaign,undefined,0,{
    quality:tier,
    beforeBegin: world => {
      observer = new ThreatObserver(world,'L3');
      const move = world.npcs!.move.bind(world.npcs);
      world.npcs!.move = (e, goal, speed, c, stop, budget) => {
        const follow = e.civilian?.ally?.follow, leader = follow && world.entities.get(follow.targetId);
        if (follow && leader) {
          const leaderSpeed = Math.hypot(leader.survivor?.velocity.x ?? 0,leader.survivor?.velocity.z ?? 0);
          if (leaderSpeed > .5 && Math.hypot(e.transform.x-leader.transform.x,e.transform.z-leader.transform.z) <= follow.maxM+2)
            speed = Math.min(speed,leaderSpeed);
        }
        return move(e,goal,speed,c,stop,budget);
      };
      if (control) world.npcs!.move = move;
      if (acceptance) new AcceptanceObserver(world);
    },
    beforeDispose: world => { observation=observer!.finish(); squad=world.missions!.state.l3; nativeStateHash=stateHash(world.getState()); },
  });
  rows.push({tier,run,observation,squad,nativeStateHash});
  console.log(tier,JSON.stringify({run,pace:observation!.phases.filter(p=>p.key==='step/checkpoint').map(p=>({median:p.followerMedian,followers:p.followerSpeeds,flags:p.flags}))}));
}
writeFileSync(`docs/reports/fix51-r8c/follow-speed-match-${rows[0].tier}-${control ? 'control' : 'trial'}-${identity.sourceHash.slice(0, 12)}${acceptance ? '-acceptance' : ''}.json`,JSON.stringify({...identity,control,acceptance,trial:'L3 armed followers match resolved leader speed inside the nearby formation band; normal maximum catch-up speed remains outside the band.',rows},null,2));
