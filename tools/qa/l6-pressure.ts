import { mkdir, writeFile } from 'node:fs/promises';
import { loadLevel } from '../sim-runner/levels';
import { LevelSixBot, type L6Profile } from '../../src/debug/bot/LevelSixBot';
import { followFrustum } from '../sim-runner/l3Bots';
import { observeAttackStarts } from './threat/attackStarts';

type QAPolicy = L6Profile | 'passive';
type Start = { sourceId: number; targetId: number; tick: number };
type Row = {
  seed: number; tier: 'high' | 'low'; policy: QAPolicy; outcome: string; completed: boolean; initialSurvivors: number; survivorsSaved: number; savedPercent: number; firstHatchClosed: number | null; exit: number | null;
  windows: { from: number; to: number; attacks: number }[]; spawnRefusals: { cap: number; reserved: number; offscreen: number; snap: number; hatch: number };
  waveCounts: Record<number, number>; closed: number[]; broken: number[]; maxAttackGapS: number | null;
  distantRecycled: number;
  pressureAdmissions: { tick: number; door: number; x: number; z: number }[]; pressureLive: { id: number; x: number; z: number; state: string; mode?: string }[];
  attackTicks: number[];
  player: { x: number; z: number; hp: number }; leaderX: number; deaths: number; simSeconds: number;
  phase: string; entries: { door: number; warnedAt: number; remaining: number; closedAt?: number; brokenAt?: number }[];
  survivorLosses: { id: number; key: string; tick: number; seconds: number; phase: string; status: string; x: number; z: number; attacks: { tick: number; sourceId: number; special: string }[] }[];
};
const rows: Row[] = [];
const minSavedPercent = Number(process.env.L6_MIN_SAVED_PERCENT ?? 25);
const averageSavedPercent = Number(process.env.L6_AVG_SAVED_PERCENT ?? 40);
const maxDeaths = Number(process.env.L6_MAX_DEATHS ?? 3);
for (const tier of (process.env.L6_TIERS ?? 'high,low').split(',') as ('high' | 'low')[]) for (const seed of (process.env.L6_SEEDS ?? '1,2,3').split(',').map(Number)) for (const policy of (process.env.L6_POLICIES ?? 'complete').split(',') as QAPolicy[]) {
  const world = await loadLevel('L6', seed, undefined, 0, { quality: tier });
  try {
    const bot = new LevelSixBot(world, policy==='passive'?'complete':policy), starts: Start[] = [];
    if(policy==='passive')world.player!.damage=()=>0;
    observeAttackStarts(world, (sourceId, targetId, tick) => starts.push({ sourceId, targetId, tick }));
    let firstHatchClosed: number | null = null, exit: number | null = null;
    const initial = new Set(world.missions!.state.l6!.survivors.map(r => r.id));
    const attackLedger = new Map<number, { tick: number; sourceId: number; special: string }[]>();
    const survivorLosses: Row['survivorLosses'] = [], seenLosses = new Set<number>();
    world.events.on('infected.attack', e => { if (e.type === 'infected.attack' && initial.has(e.targetId)) {
      const history = attackLedger.get(e.targetId) ?? []; history.push({ tick: e.tick, sourceId: e.sourceId, special: e.special }); attackLedger.set(e.targetId, history);
    }});
    world.events.on('l6.exit', e => { if (e.type === 'l6.exit') exit = e.tick; });
    let frame = undefined as ReturnType<typeof bot.sample> | undefined;
    for (let i = 0; i < 600 * 60 && !bot.finished; i++) {
      followFrustum(world); if(policy!=='typical'||i%6===0)frame=bot.sample();
      world.applyInput(policy==='passive'?{...frame!,mouseAttack:false,activeAttack:false,attackInPlace:false,attackTarget:undefined,left:{down:false,held:false,up:false},right:{down:false,held:false,up:false}}:frame!,'keyboard'); world.update();
      const s = world.missions!.state.l6!;
      for (const survivor of s.survivors) if (!seenLosses.has(survivor.id) && (survivor.status === 'dead' || survivor.status === 'turned')) {
        seenLosses.add(survivor.id); const e = world.entities.get(survivor.id);
        survivorLosses.push({ id: survivor.id, key: survivor.key, tick: world.tick, seconds: world.tick / 60, phase: s.phase,
          status: survivor.status, x: e?.transform.x ?? NaN, z: e?.transform.z ?? NaN, attacks: attackLedger.get(survivor.id) ?? [] });
      }
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
    const survivorsSaved=s.survivors.filter(r=>r.status==='out').length;
    rows.push({ seed, tier, policy, outcome: world.missions!.state.phase, completed: world.missions!.state.phase==='result'||world.missions!.state.phase==='progression', initialSurvivors: initial.size, survivorsSaved, savedPercent: 100*survivorsSaved/initial.size, firstHatchClosed, exit, windows,
      spawnRefusals: { cap: s.spawnRefusals.cap, reserved: s.spawnRefusals.reserved ?? 0, offscreen: s.spawnRefusals.offscreen, snap: s.spawnRefusals.snap, hatch: s.spawnRefusals.hatch ?? 0 }, waveCounts, maxAttackGapS,
      closed: (s.entries ?? []).filter(e => e.closedAt).map(e => e.door), broken: (s.entries ?? []).filter(e => e.brokenAt).map(e => e.door), distantRecycled:s.distantRecycled??0,
      pressureAdmissions:s.spawnLog.filter(entry=>entry.wave===3).map(({tick,door,x,z})=>({tick,door,x,z})),
      pressureLive:[...world.infected!.active].filter(e=>pressureIds.has(e.id)&&e.health.current>0).map(e=>({id:e.id,x:e.transform.x,z:e.transform.z,state:e.infected!.state,mode:e.infected!.l1?.mode})),
      attackTicks: relevant.map(x=>x.tick),
      player:{x:player.transform.x,z:player.transform.z,hp:player.health.current},leaderX:s.leaderX,deaths:world.missions!.state.stats.deaths,simSeconds:world.missions!.state.stats.time,
      phase:s.phase,entries:(s.entries??[]).map(e=>({door:e.door,warnedAt:e.warnedAt,remaining:e.remaining,closedAt:e.closedAt,brokenAt:e.brokenAt})), survivorLosses });
  } finally { world.dispose(); }
  console.log(`[l6-pressure] ${tier} ${policy} seed ${seed} complete`);
}
const expectedRuns = (process.env.L6_TIERS ?? 'high,low').split(',').length * (process.env.L6_SEEDS ?? '1,2,3').split(',').length;
const completeRows = rows.filter(row => row.policy === 'complete');
const measuredRows = completeRows.length ? completeRows : rows;
const savedAverage = measuredRows.length ? measuredRows.reduce((sum, row) => sum + row.savedPercent, 0) / measuredRows.length : 0;
const failures = rows.filter(row => row.policy === 'early-close' && (row.exit === null || row.maxAttackGapS === null || row.maxAttackGapS >= 30)
  || row.policy === 'complete' && (!row.completed || row.deaths > maxDeaths || row.savedPercent < minSavedPercent
    || row.windows.some(window => window.to - window.from === 1800 && window.attacks < 2))) ;
if (completeRows.length !== expectedRuns || completeRows.reduce((sum, row) => sum + row.savedPercent, 0) / (completeRows.length || 1) < averageSavedPercent) failures.push(...completeRows);
const output = process.env.L6_PRESSURE_OUT ?? 'test-results/s97-l6balance/native.json';
await mkdir(output.slice(0, output.lastIndexOf('/')), { recursive: true });
await writeFile(output, JSON.stringify({ generatedAt: new Date().toISOString(), criteria: { maxDeaths, averageSavedPercent, minSavedPercent, fullPostClosureWindowAttacks: 2 }, savedAveragePercent: savedAverage, rows }, null, 2) + '\n');
console.log(`[l6-pressure] ${rows.length} runs; ${failures.length} L6 balance failures; mean saved ${savedAverage.toFixed(1)}%; receipt ${output}`);
if (failures.length) process.exitCode = 1;
