/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic script (r31-flamingo), not shipped */
// Usage: node --import tsx/esm tools/qa/diag/l8flock.ts <seed> [trace]
// Prints the flamingo flock timeline: turned / alive / dead counts, arena phase, protect window, player distance to the entry.
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
import { l8BossArenas } from '../../../src/data/l8Bosses';
const seed = Number(process.argv[2] ?? 1), trace = process.argv[3] === 'trace';
const campaign: any = preset('L8-default' as any);
campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const zoo = w.missions.l8, player = w.entities.get(1), arena = zoo.state.arenas.find((a: any) => a.id === 'flamingo');
const def = l8BossArenas.find((d: any) => d.id === 'flamingo')!;
let engagedAt = -1, aliveAtEngage = -1, firstTurnAt = -1, clearAt = -1, hp0 = -1, hpMin = 1e9;
let lastPrint = -1, protEndAt = -1, notDeadAtProtEnd = -1, wasProt = false;
for (let i = 0; i < 1300 * 60 && !bot.finished && (clearAt < 0 || (process.argv[3] === 'tail' && i < 700 * 60)); i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  const es = arena.ids.map((id: number) => w.entities.get(id));
  const turned = es.filter((e: any) => e?.infected).length, alive = es.filter((e: any) => e?.infected && e.health.current > 0).length;
  const civ = es.filter((e: any) => e?.civilian && e.health.current > 0).length;
  const prot = zoo.protecting();
  if (wasProt && !prot && protEndAt < 0) { protEndAt = w.tick; notDeadAtProtEnd = es.filter((e: any) => e && e.health.current > 0).length; }
  wasProt = prot;
  if (turned && firstTurnAt < 0) firstTurnAt = w.tick;
  if (arena.phase >= 1 && engagedAt < 0) { engagedAt = w.tick; aliveAtEngage = alive; hp0 = player.health.current; }
  if (arena.phase === 3 && clearAt < 0) clearAt = w.tick;
  if (engagedAt >= 0 && clearAt < 0) hpMin = Math.min(hpMin, player.health.current);
  const sec = Math.floor(w.tick / 60);
  if (process.argv[3] === 'tail' && clearAt >= 0 && sec !== lastPrint && sec % 20 === 0) { lastPrint = sec; const live = arena.ids.map((id: number) => w.entities.get(id)).filter((e: any) => e && e.health.current > 0); const near = [...w.entities.iterate()].filter((e: any) => e.id !== 1 && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 2.5).map((e: any) => `${e.archetype}${e.corpse ? '*' : ''}:${e.health.current | 0}`); const mv = bot.sample().move; console.log('SWEEP', w.solids.sweep(player, { x: mv.x, z: mv.z }, 3), 'pos', player.transform.x.toFixed(2), player.transform.z.toFixed(2), 'groundY', player.transform.y.toFixed(2)); console.log('NEAR', near.join(' '), 'move', JSON.stringify(bot.sample().move), 'goalstate', player.locomotion?.vx?.toFixed?.(2)); console.log('TAIL', sec, 'pos', Math.round(player.transform.x), Math.round(player.transform.z), 'liveFlamingos', live.map((e: any) => `${e.id}:${e.infected ? e.infected.state : 'civ'}@${Math.round(e.transform.x)},${Math.round(e.transform.z)}`).join(' '), 'nextArena', zoo.state.arenas.map((a: any) => a.phase).join('')); }
  if (trace && sec !== lastPrint && sec % 2 === 0 && (turned || arena.phase)) {
    lastPrint = sec;
    console.log('T', sec, 'phase', arena.phase, 'civ', civ, 'turned', turned, 'alive', alive, 'prot', zoo.protecting(), 'dEntry', Math.round(Math.hypot(player.transform.x - def.entry.x, player.transform.z - def.entry.z)), 'dCentre', Math.round(Math.hypot(player.transform.x - def.centre.x, player.transform.z - def.centre.z)), 'carrier', arena.carrier);
  }
}
const s = (t: number) => t < 0 ? 'n/a' : (t / 60).toFixed(1);
console.log('FLOCK', seed, 'firstTurn', s(firstTurnAt), 'engage', s(engagedAt), 'aliveAtEngage', aliveAtEngage, 'of', def.count, 'fightSec', clearAt < 0 ? 'n/a' : ((clearAt - engagedAt) / 60).toFixed(1), 'notDeadAtProtectEnd', notDeadAtProtEnd, 'titleVisibleSec', protEndAt < 0 || clearAt < 0 ? 'n/a' : Math.max(0, (clearAt - protEndAt) / 60).toFixed(1), 'courierHpLoss', hp0 < 0 ? 'n/a' : Math.round(hp0 - hpMin), 'hp0', Math.round(hp0));
process.exit(0);
