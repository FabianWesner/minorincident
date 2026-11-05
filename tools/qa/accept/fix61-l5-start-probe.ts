/** Read-only: L5 complete route, log followers around given tick windows (courier speed, distance, behind, motion, combat).
 * Usage: node --import tsx/esm tools/qa/accept/fix61-l5-start-probe.ts low|high id:from-to[,id:from-to] */
import { runLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
import { followerInCombat } from '../../../src/sim/outbreak/Survivors';

const tier = process.argv[2] === 'high' ? 'high' : 'low';
const windows = (process.argv[3] ?? '').split(',').filter(Boolean).map(w => { const [id, span] = w.split(':'); const [a, b] = span.split('-').map(Number); return { id: Number(id), a, b }; });
const campaign = preset('L5-default'); campaign.settings.quality = tier;
const r = (n: number) => n.toFixed(2);
await runLevel('L5', 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const update = world.update.bind(world);
    world.update = () => {
      const player = world.entities.get(1)!, before = { ...player.transform }, tick = world.tick;
      update(); if (world.tick === tick) return;
      const vx = (player.transform.x - before.x) * 60, vz = (player.transform.z - before.z) * 60, speed = Math.hypot(vx, vz);
      for (const w of windows) if (world.tick >= w.a && world.tick <= w.b && (world.tick - w.a) % 3 === 0) {
        const e = world.entities.get(w.id); if (!e) continue;
        const d = Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z);
        const behind = speed > .2 ? ((player.transform.x - e.transform.x) * vx + (player.transform.z - e.transform.z) * vz) / speed : NaN;
        const s = e.civilian?.survivor, blocker = world.solids.blockingBody(e.id);
        const near = [...world.entities.iterate()].filter(o => o.id !== e.id && o.id !== 1 && Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z) < 1.6)
          .map(o => `${o.id}:${o.archetype}@${r(Math.hypot(o.transform.x - e.transform.x, o.transform.z - e.transform.z))}`).join(' ');
        console.log(`#${w.id} t${world.tick} cs=${r(speed)} d=${r(d)} behind=${r(behind)} fs=${r(e.motion?.speed ?? 0)} f(${r(e.transform.x)},${r(e.transform.z)}) p(${r(player.transform.x)},${r(player.transform.z)}) slot=${s?.slot} state=${e.civilian?.state} combat=${followerInCombat(world, e)} vis=${world.infected!.nav.visible(e.transform, player.transform, .35)} pv=${r(Math.hypot(player.survivor?.velocity.x ?? 0, player.survivor?.velocity.z ?? 0))} blocker=${blocker ? blocker.id + ':' + blocker.archetype : '-'} near=[${near}]`);
      }
    };
  },
});
