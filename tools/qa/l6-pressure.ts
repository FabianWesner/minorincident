import { mkdir, writeFile } from 'node:fs/promises';
import { loadLevel } from '../sim-runner/levels';
import { LevelSixBot, type L6Profile } from '../../src/debug/bot/LevelSixBot';
import { followFrustum } from '../sim-runner/l3Bots';
import { observeAttackStarts } from './threat/attackStarts';

type QAPolicy = L6Profile | 'passive';
type Start = { sourceId: number; targetId: number; tick: number };
type Row = {
  seed: number; policy: QAPolicy; outcome: string; firstHatchClosed: number | null; exit: number | null;
  windows: { from: number; to: number; attacks: number }[]; spawnRefusals: { cap: number; reserved: number; offscreen: number; snap: number; hatch: number };
  waveCounts: Record<number, number>; closed: number[]; broken: number[]; maxAttackGapS: number | null;
  distantRecycled: number;
  pressureAdmissions: { tick: number; door: number; x: number; z: number }[]; pressureLive: { id: number; x: number; z: number; state: string; mode?: string }[];
  attackTicks: number[];
  player: { x: number; z: number; hp: number }; leaderX: number; deaths: number; simSeconds: number;
  phase: string; entries: { door: number; warnedAt: number; remaining: number; closedAt?: number; brokenAt?: number }[];
};
const rows: Row[] = [];
for (const seed of (process.env.L6_SEEDS ?? '1,2,3').split(',').map(Number)) for (const policy of (process.env.L6_POLICIES ?? 'early-close,complete,passive,evade-only').split(',') as QAPolicy[]) {
  const world = await loadLevel('L6', seed, undefined, 0, { quality: 'low' });
  try {
    const bot = new LevelSixBot(world, policy==='passive'?'complete':policy), starts: Start[] = [];
    if(policy==='passive')world.player!.damage=()=>0;
    observeAttackStarts(world, (sourceId, targetId, tick) => starts.push({ sourceId, targetId, tick }));
    let firstHatchClosed: number | null = null, exit: number | null = null;
    const initial = new Set(world.missions!.state.l6!.survivors.map(r => r.id));
    world.events.on('l6.exit', e => { if (e.type === 'l6.exit') exit = e.tick; });
    for (let i = 0; i < 600 * 60 && !bot.finished; i++) {
      followFrustum(world); const frame=bot.sample();
      world.applyInput(policy==='passive'?{...frame,mouseAttack:false,activeAttack:false,attackInPlace:false,attackTarget:undefined,left:{down:false,held:false,up:false},right:{down:false,held:false,up:false}}:frame,'keyboard'); world.update();
      const s = world.missions!.state.l6!;
      if (firstHatchClosed === null && s.entries?.some(e => e.closedAt)) firstHatchClosed = Math.min(...s.entries.filter(e => e.closedAt).map(e => e.closedAt!));
    }
    const s = world.missions!.state.l6!, end = exit ?? world.tick;
    const from = firstHatchClosed ?? end, windows: Row['windows'] = [];
    const relevant = starts.filter(x => x.tick >= from && x.tick < end && (x.targetId === 1 || initial.has(x.targetId))).sort((a,b)=>a.tick-b.tick);
    const maxAttackGapS = firstHatchClosed === null ? null : relevant.length ? Math.max(relevant[0].tick-from, end-relevant.at(-1)!.tick,
      ...relevant.slice(1).map((x,i)=>x.tick-relevant[i].tick)) / 60 : (end-from)/60;
    for (let a = from; a < end; a += 1800) {
      const b = Math.min(end, a + 1800);
      windows.push({ from: a, to: b, attacks: relevant.filter(x => x.tick >= a && x.tick < b).length });
    }
    const waveCounts: Record<number, number> = {};
    for (const entry of s.spawnLog) waveCounts[entry.wave] = (waveCounts[entry.wave] ?? 0) + 1;
    const player=world.entities.get(1)!;
    const pressureIds=new Set(s.spawnLog.filter(entry=>entry.wave===3).map(entry=>entry.id));
    rows.push({ seed, policy, outcome: world.missions!.state.phase, firstHatchClosed, exit, windows,
      spawnRefusals: { cap: s.spawnRefusals.cap, reserved: s.spawnRefusals.reserved ?? 0, offscreen: s.spawnRefusals.offscreen, snap: s.spawnRefusals.snap, hatch: s.spawnRefusals.hatch ?? 0 }, waveCounts, maxAttackGapS,
      closed: (s.entries ?? []).filter(e => e.closedAt).map(e => e.door), broken: (s.entries ?? []).filter(e => e.brokenAt).map(e => e.door), distantRecycled:s.distantRecycled??0,
      pressureAdmissions:s.spawnLog.filter(entry=>entry.wave===3).map(({tick,door,x,z})=>({tick,door,x,z})),
      pressureLive:[...world.infected!.active].filter(e=>pressureIds.has(e.id)&&e.health.current>0).map(e=>({id:e.id,x:e.transform.x,z:e.transform.z,state:e.infected!.state,mode:e.infected!.l1?.mode})),
      attackTicks: relevant.map(x=>x.tick),
      player:{x:player.transform.x,z:player.transform.z,hp:player.health.current},leaderX:s.leaderX,deaths:world.missions!.state.stats.deaths,simSeconds:world.missions!.state.stats.time,
      phase:s.phase,entries:(s.entries??[]).map(e=>({door:e.door,warnedAt:e.warnedAt,remaining:e.remaining,closedAt:e.closedAt,brokenAt:e.brokenAt})) });
  } finally { world.dispose(); }
  console.log(`[l6-pressure] ${policy} seed ${seed} complete`);
}
await mkdir('docs/reports/s81-l6pressure', { recursive: true });
await writeFile('docs/reports/s81-l6pressure/native.json', JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + '\n');
const failures = rows.filter(row => row.policy === 'early-close' && (row.exit === null || row.maxAttackGapS === null || row.maxAttackGapS >= 30)
  || row.policy === 'complete' && row.exit === null);
console.log(`[l6-pressure] ${rows.length} runs; ${failures.length} early-close pressure or skilled completion failures; receipt docs/reports/s81-l6pressure/native.json`);
if (failures.length) process.exitCode = 1;
