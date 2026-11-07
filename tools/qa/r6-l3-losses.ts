/** r6-l3: where the squad is lost (complete policy, mortal). Usage: --tier low|high --seeds 1,2,3 */
import { loadL3, runL3 } from '../sim-runner/l3Bots';
const arg = (name: string, fallback: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : fallback; };
const tier = arg('tier', 'low') as 'low' | 'high', profile = arg('profile', 'complete') as 'complete' | 'newbie';
for (const seed of arg('seeds', '1,2,3').split(',').map(Number)) {
  const { world, mission } = await loadL3(seed, tier);
  const xs: string[] = [];
  world.events.on('l3.squad-lost', e => { xs.push(`${(e as {cause?:string}).cause}@x${world.entities.get(1)!.transform.x.toFixed(0)}`); });
  const r = runL3(world, mission, profile, { seed, maxSeconds: 600, god: false });
  console.log(JSON.stringify({ tier, profile, seed, outcome: r.outcome, t: r.simSeconds.toFixed(0), deaths: r.deaths, damage: Math.round(r.damage), atFallback: r.squad?.atFallback, segEnds: r.squad?.segmentEnds, army: r.squad?.atCheckpoint, losses: xs, near30: r.density.near30, max: r.density.maxConcurrent }));
  world.dispose();
}
