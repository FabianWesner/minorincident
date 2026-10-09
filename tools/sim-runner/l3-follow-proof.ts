import { mkdirSync, writeFileSync } from 'node:fs';
import { loadL3, runL3 } from './l3Bots';
const { world, mission } = await loadL3(1);
const seen = new Set<number>();
let soldierShots = 0;
world.events.on('ally.attack', e => { if (e.type === 'ally.attack' && e.role === 'soldier') soldierShots++; });
const unlisten = world.events.on('sim.tick', () => {
  const s = mission.state.l3!;
  for (const id of [...s.segmentIds.flat(), ...s.spillIds, ...s.pressureIds, ...(s.finaleIds ?? [])]) seen.add(id);
});
const report = runL3(world, mission, 'complete', { seed: 1, maxSeconds: 600 });
unlisten();
mkdirSync('test-results/epics/E21', { recursive: true });
writeFileSync('test-results/epics/E21/squad-follow-bot.json', JSON.stringify({ ...report, streetSpawned: seen.size, soldierShots, finalePacks: mission.state.l3!.finalePacks, finaleSpawned: mission.state.l3!.finaleIds?.length, barrierClosedAt: mission.state.l3!.barrierClosedAt }, null, 2));
console.log(JSON.stringify({ outcome: report.outcome, deaths: report.deaths, simSeconds: report.simSeconds, streetSpawned: seen.size, squad: report.squad }));
world.dispose();
if (report.outcome !== 'complete') process.exitCode = 1;
