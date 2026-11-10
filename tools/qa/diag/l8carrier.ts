/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic script (r26-l8follow), not shipped */
// Usage: node --import tsx/esm tools/qa/diag/l8carrier.ts [seed] [quiet]
// Per boss arena: seconds between the courier standing inside the arena trigger geometry (entry < 12 m, or inside 0.75 R)
// and the arena starting (phase >= 1) = "dead time". Prints one RESULT line.
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
import { l8BossArenas } from '../../../src/data/l8Bosses';
const seed = Number(process.argv[2] ?? 1), quiet = process.argv[3] === 'quiet';
const campaign: any = preset('L8-default' as any);
campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const zoo = w.missions.l8, player = w.entities.get(1);
const near: Record<string, number> = {}, start: Record<string, number> = {};
for (let i = 0; i < 1300 * 60 && !bot.finished; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  for (const a of zoo.state.arenas) {
    const def = l8BossArenas.find((d: any) => d.id === a.id)!;
    if (a.phase === 0 && near[a.id] === undefined && (Math.hypot(player.transform.x - def.entry.x, player.transform.z - def.entry.z) < 12 || Math.hypot(player.transform.x - def.centre.x, player.transform.z - def.centre.z) < def.radius * .75)) near[a.id] = w.tick;
    if (a.phase >= 1 && start[a.id] === undefined) start[a.id] = w.tick;
  }
  if (!quiet && i % (10 * 60) === 0) {
    const za = zoo.state.arenas[1], c = w.entities.get(za.carrier);
    if (za.phase === 0) console.log('Z', (i / 60) | 0, 'player', player.transform.x | 0, player.transform.z | 0, 'carrier', za.carrier, c ? `@${c.transform.x.toFixed(0)},${c.transform.z.toFixed(0)} emerging=${c.emerging}` : 'none');
  }
}
const wait = Object.keys(start).map(id => `${id}:${near[id] !== undefined ? Math.max(0, Math.round((start[id] - near[id]) / 60)) : '?'}s`).join(' ');
console.log('RESULT seed', seed, 'wait', wait, 'end', bot.finished, (w.tick / 60) | 0);
process.exit(0);
