/* eslint-disable @typescript-eslint/no-explicit-any -- r33-l8route: where do the breach cohorts go while the courier waits in the plaza? */
import { loadLevel } from '../../sim-runner/levels';
import { preset } from '../../../src/sim/progression/Campaign';
const campaign: any = preset('L8-default' as any); campaign.seed = 1; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', 1, campaign, 0, { quality: 'low' } as any);
const zoo = w.missions.l8, p = w.entities.get(1);
w.combat.damage.god = true;
w.solids.relocate(p, { x: 1, z: 0, y: .7 }, 'probe', 90, false);
zoo.followers().forEach((e: any, n: number) => w.solids.relocate(e, { x: (n % 6 - 2.5) * 1.5, z: 2 + Math.floor(n / 6) * 1.5, y: e.transform.y }, 'probe', 90, false));
zoo.advance();
for (let t = 0; t < 70 * 60; t++) {
  w.update();
  if (t % (5 * 60) === 0 || t === 0) {
    const live = [...w.infected.active].filter((e: any) => e.health.current > 0 && !e.infected.arenaBoss);
    const d = live.map((e: any) => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z));
    console.log(`t=${(t / 60) | 0}s sealed=${zoo.state.sealedAt > 0} protecting=${zoo.protecting()} infected=${live.length} nearest=${Math.min(...d, 999).toFixed(0)}m player=${p.transform.x.toFixed(0)},${p.transform.z.toFixed(0)} attackers=${live.filter((e: any) => e.infected.state === 'attack').length}`);
    if (t === 20 * 60) console.log(live.map((e: any) => `${e.id}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)} ${e.infected.state}${e.emerging ? ' emerging' : ''}`).join(' | '));
  }
}
process.exit(0);
