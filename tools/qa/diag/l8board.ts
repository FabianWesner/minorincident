/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic script (r26-l8follow), not shipped */
// Usage: node --import tsx/esm tools/qa/diag/l8board.ts [seed] [fromS] [toS]  -- who blocks the L8 boarding queue
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
const seed = Number(process.argv[2] ?? 1), from = Number(process.argv[3] ?? 545), to = Number(process.argv[4] ?? 600);
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const zoo = w.missions.l8;
for (let i = 0; i < to * 60 && !bot.finished; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  if (i >= from * 60 && i % (6 * 60) === 0) {
    const door = w.vehicles.passengerDoor(zoo.state.carId), seated = new Set((w.entities.get(zoo.state.carId).vehicle.passengers ?? []).filter((p: any) => p.phase === 'seated').map((p: any) => p.id));
    const queue = zoo.passengers().filter((id: number) => !seated.has(id));
    const head = w.entities.get(queue[0]);
    console.log(`t=${(i / 60) | 0} boarding=${zoo.boarding()} door=${door.x.toFixed(0)},${door.z.toFixed(0)} queue=${queue.length} head=${queue[0]}@${head?.transform.x.toFixed(1)},${head?.transform.z.toFixed(1)} detour=${JSON.stringify(zoo.boardingDetours?.get(queue[0])?.path?.length)} stagger=${head?.combat?.staggerUntil - w.tick} state=${head?.civilian?.state}`);
    if (head) {
      const near = [...w.entities.iterate()].filter((e: any) => e.id !== head.id && Math.hypot(e.transform.x - head.transform.x, e.transform.z - head.transform.z) < 3).map((e: any) => `${e.id}:${e.archetype}:${e.health.current > 0 ? 'live' : 'dead'}@${e.transform.x.toFixed(0)},${e.transform.z.toFixed(0)}`);
      console.log('   near', near.join(' '));
    }
  }
}
process.exit(0);
