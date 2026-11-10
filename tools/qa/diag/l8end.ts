/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic (r27-l8board) */
// Usage: node --import tsx/esm tools/qa/diag/l8end.ts [seed] [fromS] [toS] -- steps/player/APC after boarding
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
const seed = Number(process.argv[2] ?? 3), from = Number(process.argv[3] ?? 495), to = Number(process.argv[4] ?? 700);
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const zoo = w.missions.l8, p = w.entities.get(1);
for (let i = 0; i < to * 60 && !bot.finished; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  if (i >= from * 60 && i % (5 * 60) === 0) {
    const car = w.entities.get(zoo.state.carId), st = w.missions.state.steps;
    console.log(`t=${(i / 60) | 0} player=${p.transform.x.toFixed(0)},${p.transform.z.toFixed(0)} hidden=${!!p.hidden} car=${car.transform.x.toFixed(0)},${car.transform.z.toFixed(0)} driver=${car.vehicle.driver} pass=${car.vehicle.passengers?.length} active=${w.vehicles.active} steps=${Object.entries(st).filter(([, v]: any) => v.status === 'active').map(([k]) => k)} canDrive=${zoo.canDrive()}`);
  }
}
const car = w.entities.get(zoo.state.carId);
console.log('DUMP canBoardDriver', zoo.canBoardDriver(), 'breached', zoo.breached, 'arenas', JSON.stringify(zoo.state.arenas.map((a: any) => a.phase)), 'hale', !!w.missions.state.states['hale-fallen'], 'roster', JSON.stringify(zoo.passengers()), 'seated', JSON.stringify((car.vehicle.passengers ?? []).map((q: any) => q.id + ':' + q.phase)));
console.log('DUMP bot', JSON.stringify({ phase: bot.phase, state: bot.state, stuck: bot.stuck, goal: bot.goal }), 'door', JSON.stringify(w.vehicles.passengerDoor(zoo.state.carId)));
console.log('DUMP near', [...w.entities.iterate()].filter((e: any) => Math.hypot(e.transform.x - p.transform.x, e.transform.z - p.transform.z) < 3).map((e: any) => e.id + ':' + e.archetype + '@' + e.transform.x.toFixed(1) + ',' + e.transform.z.toFixed(1)).join(' '));
process.exit(0);
