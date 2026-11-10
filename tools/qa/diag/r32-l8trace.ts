/* eslint-disable @typescript-eslint/no-explicit-any -- r32-l8route-plan: trace the complete bot's L8 route */
// Usage: node --import tsx/esm tools/qa/diag/r32-l8trace.ts <seed> <out.json> [maxSeconds]
import { writeFileSync } from 'node:fs';
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelEightBot } from '../../../src/debug/bot/LevelEightBot';
import { preset } from '../../../src/sim/progression/Campaign';
const seed = Number(process.argv[2] ?? 1), out = process.argv[3]!, maxS = Number(process.argv[4] ?? 900);
const campaign: any = preset('L8-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L8', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelEightBot(w, 'complete');
const zoo = w.missions.l8, p = w.entities.get(1), pts: any[] = [], events: any[] = [];
let last = '';
for (let i = 0; i < maxS * 60 && !bot.finished; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  const phases = zoo.state.arenas.map((a: any) => a.id[0] + a.phase).join('');
  const key = phases + (zoo.protecting() ? 'P' : '') + (w.missions.state.states.breached ? 'B' : '');
  if (key !== last) { events.push({ t: i / 60, x: p.transform.x, z: p.transform.z, key }); last = key; console.log(`t=${(i / 60).toFixed(0)} ${key} @${p.transform.x.toFixed(0)},${p.transform.z.toFixed(0)}`); }
  if (i % 30 === 0) {
    const g = zoo.roster().map((id: number) => w.entities.get(id)).filter((e: any) => e && e.health.current > 0 && e.passengerOf === undefined);
    const gx = g.length ? g.reduce((s: number, e: any) => s + e.transform.x, 0) / g.length : null;
    const gz = g.length ? g.reduce((s: number, e: any) => s + e.transform.z, 0) / g.length : null;
    pts.push([+(i / 60).toFixed(1), +p.transform.x.toFixed(1), +p.transform.z.toFixed(1), gx === null ? null : +gx.toFixed(1), gz === null ? null : +gz.toFixed(1), w.vehicles.active !== null ? 1 : 0]);
  }
}
writeFileSync(out, JSON.stringify({ seed, finished: bot.finished, phase: w.missions.state.phase, pts, events }));
console.log('done', bot.finished, pts.length);
process.exit(0);
