/* eslint-disable @typescript-eslint/no-explicit-any -- one-off diagnostic (PO UAT 11-10: L3 officers never lose health) */
// Usage: node --import tsx/esm tools/qa/diag/l3squadhp.ts [seed] [profile=newbie]
// Runs L3 with the bot and logs every L3 squad officer's health changes, bites on them and infected attacks targeting them.
import { loadLevel } from '../../sim-runner/levels';
import { followFrustum } from '../../sim-runner/l3Bots';
import { LevelThreeBot } from '../../../src/debug/bot/LevelThreeBot';
import { preset } from '../../../src/sim/progression/Campaign';
const seed = Number(process.argv[2] ?? 1), profile = (process.argv[3] ?? 'newbie') as any;
const campaign: any = preset('L3-default' as any); campaign.seed = seed; campaign.settings.quality = 'low';
const w: any = await loadLevel('L3', seed, campaign, 0, { quality: 'low' } as any);
const bot: any = new LevelThreeBot(w, w.missions, profile);
const last = new Map<number, number>(), counts = { attacksOnSquad: 0, grabsOnSquad: 0, hpDrops: 0 };
w.events.on('infected.attack', (ev: any) => { if (w.missions.state.l3?.squadIds?.includes(ev.targetId)) counts.attacksOnSquad++; });
w.events.on('mission.signal', (ev: any) => console.log(`t${w.tick} signal ${ev.name}`));
w.events.on('player.died', () => console.log(`t${w.tick} PLAYER DIED`));
w.events.on('mission.checkpoint', (ev: any) => console.log(`t${w.tick} checkpoint ${ev.id ?? ''}`));
w.events.on('civilian.grabbed', (ev: any) => { if (w.missions.state.l3?.squadIds?.includes(ev.targetId)) counts.grabsOnSquad++; });
for (let i = 0; i < 600 * 60; i++) {
  followFrustum(w); w.applyInput(bot.sample(), 'keyboard'); w.update();
  for (const id of w.missions.state.l3?.squadIds ?? []) {
    const e = w.entities.get(id); if (!e) continue;
    const prev = last.get(id); if (prev !== undefined && e.health.current < prev) { counts.hpDrops++; console.log(`t${w.tick} officer ${id} hp ${prev} -> ${e.health.current}`); }
    if (prev !== undefined && e.health.current > prev) console.log(`t${w.tick} officer ${id} HEAL ${prev} -> ${e.health.current}`);
    last.set(id, e.health.current);
  }
  if (w.missions.state.phase !== 'playing') break;
}
console.log('RESULT', JSON.stringify({ seed, profile, tick: w.tick, phase: w.missions.state.phase, ...counts, squad: (w.missions.state.l3?.squadIds ?? []).map((id: number) => { const e = w.entities.get(id); return { id, hp: e?.health.current, max: e?.health.max, infection: !!e?.infection }; }), lost: w.missions.state.l3?.lost }));
