/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic script (r27-l8board), not shipped */
// Usage: node --import tsx/esm tools/qa/diag/l8idle.ts [seed]
// Skilled L8 run; while boarding is open, longest time any unseated group member (corgi, queue head, followers)
// (reads the roster cache; zoo.passengers() refreshes it and perturbs the run) stays within 0.25 m of one spot while still > 1 m from the APC door. One RESULT line.
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
const seed = Number(process.argv[2] ?? 1);
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const zoo = w.missions.l8;
const anchor = new Map<number, { x: number; z: number; tick: number }>();
let worst = 0, worstId = 0, worstAt = 0, boardStart = -1, headWorst = 0;
for (let i = 0; i < 1300 * 60 && !bot.finished; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  if (!zoo.boarding()) { anchor.clear(); continue; }
  if (boardStart < 0) boardStart = w.tick;
  const door = w.vehicles.passengerDoor(zoo.state.carId);
  const seated = new Set((w.entities.get(zoo.state.carId).vehicle.passengers ?? []).filter((p: any) => p.phase === 'seated').map((p: any) => p.id));
  const queue = [...zoo.passengersCache].filter((id: number) => !seated.has(id));
  for (const k of [...anchor.keys()]) if (!queue.includes(k) || Math.hypot(w.entities.get(k)?.transform.x - door.x, w.entities.get(k)?.transform.z - door.z) < 1) anchor.delete(k);
  for (const id of queue) {
    const e = w.entities.get(id); if (!e) continue;
    if (Math.hypot(e.transform.x - door.x, e.transform.z - door.z) < 1) continue;
    const a = anchor.get(id);
    if (!a || Math.hypot(e.transform.x - a.x, e.transform.z - a.z) > .25) { anchor.set(id, { x: e.transform.x, z: e.transform.z, tick: w.tick }); continue; }
    const idle = (w.tick - a.tick) / 60;
    if (idle > worst) { worst = idle; worstId = id; worstAt = (w.tick / 60) | 0; }
    if (id === queue[0] && idle > headWorst) headWorst = idle;
  }
}
console.log(`RESULT seed ${seed} end ${bot.finished} ${(w.tick / 60) | 0}s boardStart ${boardStart < 0 ? '-' : (boardStart / 60) | 0}s worstIdle ${worst.toFixed(1)}s id ${worstId} at ${worstAt}s headIdle ${headWorst.toFixed(1)}s`);
process.exit(0);
