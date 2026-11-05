/** Read-only: print one infected's position, the courier's and the bounded path stretch at a tick of the canonical complete route. */
import { runLevel, type RunnerLevel } from '../../sim-runner/levels';
import { preset, type ProgressionPreset } from '../../../src/sim/progression/Campaign';
import { PathProbe } from '../threat/observer';

const [level, tierArg, tickArg, idsArg] = process.argv.slice(2);
const tier = tierArg === 'high' ? 'high' : 'low', at = Number(tickArg), ids = idsArg.split(',').map(Number);
const campaign = preset(`${level}-default` as ProgressionPreset); campaign.settings.quality = tier;
await runLevel(level as RunnerLevel, 'complete', 1, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => {
    const paths = new PathProbe();
    world.events.on('sim.tick', () => {
      if (world.tick < at - 240 || world.tick > at || (at - world.tick) % 60) return;
      const p = world.entities.get(1)!.transform;
      for (const id of ids) {
        const e = world.entities.get(id); if (!e) continue;
        const direct = Math.hypot(e.transform.x - p.x, e.transform.z - p.z);
        const path = paths.distance(world.infected!.infectedNav, e, p);
        console.log(JSON.stringify({ tick: world.tick, id, arch: e.archetype, hp: e.health.current, x: +e.transform.x.toFixed(2), z: +e.transform.z.toFixed(2), px: +p.x.toFixed(2), pz: +p.z.toFixed(2), direct: +direct.toFixed(2), path: Number.isFinite(path) ? +path.toFixed(2) : null, state: e.infected?.state, hidden: e.hidden, pending: e.pendingAdmission }));
      }
    }, 9);
  },
});
