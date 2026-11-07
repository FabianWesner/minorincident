/** blk-l3: L3 native complete run (qa:threat army-seed setup); dog separation, squad count at the army line, trail fallbacks. */
import { runLevel } from '../sim-runner/levels';
import { preset } from '../../src/sim/progression/Campaign';
const seed = Number(process.argv[2] ?? 3), tier = (process.argv[3] ?? 'low') as 'low' | 'high';
const campaign = preset('L3-default'); campaign.seed = seed; campaign.settings.quality = tier;
let maxSep = 0, sepAtCross = -1, squadAtCross = -1, stuckS = 0, last = { x: 0, z: 0 };
const run = await runLevel('L3', 'complete', seed, undefined, 'auto', campaign, undefined, 0, {
  quality: tier,
  beforeBegin: world => world.events.on('sim.tick', () => {
    if (world.tick % 30) return;
    const p = world.entities.get(1)!.transform, dog = [...world.entities.iterate()].find(e => e.companion), s = world.missions?.state.l3;
    if (!dog || !s?.fallbackAt) return;
    const sep = Math.hypot(dog.transform.x - p.x, dog.transform.z - p.z); maxSep = Math.max(maxSep, sep);
    if (sep > 8 && Math.hypot(dog.transform.x - last.x, dog.transform.z - last.z) < .05) stuckS += .5;
    last = { x: dog.transform.x, z: dog.transform.z };
    if (s.crossedAt && sepAtCross < 0) { sepAtCross = sep; squadAtCross = s.squad.length; }
  }),
});
console.log(JSON.stringify({ seed, tier, outcome: run.outcome, maxSep: +maxSep.toFixed(1), sepAtCross: +sepAtCross.toFixed(1), squadAtCross, dogStuckWhileFarS: stuckS }));
