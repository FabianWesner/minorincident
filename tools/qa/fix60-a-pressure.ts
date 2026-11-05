import { emptyInput, type InputFrame } from '../../src/input/InputFrame';
import { LevelThreeBot } from '../../src/debug/bot/LevelThreeBot';
import { loadL3, followFrustum } from '../sim-runner/l3Bots';
import type { Tier } from './accept/probe';

/** fix60-a: Reach the requested progress line through ordinary inputs, step back, idle, then advance. Protection is count-only. */
export async function pressureAtLine(tier: Tier, line: number) {
  const { world, mission } = await loadL3(1, tier);
  try {
    world.combat!.damage.god = true;
    const bot = new LevelThreeBot(world, 'complete', 'auto');
    const tick = (frame: InputFrame) => { followFrustum(world); world.applyInput(frame, 'keyboard'); world.update(); };
    while (world.tick < 600 * 60 && !(mission.state.l3!.phase === 'corridor' && world.entities.get(1)!.transform.x >= line)) tick(bot.sample());
    if (mission.state.l3!.phase !== 'corridor' || world.entities.get(1)!.transform.x < line) throw new Error(`Pressure probe did not reach line${line} by ordinary input`);
    const retirements: object[] = [];
    let pressureRetirement = false;
    const controller = mission.l3 as unknown as { retirePressureFillers(): void };
    const retireFillers = controller.retirePressureFillers.bind(controller);
    controller.retirePressureFillers = () => { pressureRetirement = true; try { retireFillers(); } finally { pressureRetirement = false; } };
    const release = world.infected!.release.bind(world.infected!);
    world.infected!.release = entity => { const p = world.entities.get(1)!.transform, b = entity.infected!, s = mission.state.l3!; retirements.push({ tick: world.tick, id: entity.id, pressureRetirement, authored: [...s.waveIds,...s.pressureIds,...s.spillIds,...(s.finaleIds??[]),...s.pending.filter(q=>q.horde&&q.id>0).map(q=>q.id)].includes(entity.id), hp: entity.health.current, corpse: !!entity.corpse, rising: !!entity.infectionRise, attacking: !!entity.combat?.attacking, special: !!b.specialAttack, at: { ...entity.transform }, distance: Math.hypot(entity.transform.x-p.x,entity.transform.z-p.z), offscreen: world.infected!.director.offscreen(entity.transform,entity.transform.y-.7), state: b.state, mode: b.l1?.mode, recoverAt: b.recoverAt, emerging: !!entity.emerging }); return release(entity); };
    const start = { tick: world.tick, player: { ...world.entities.get(1)!.transform }, furthest: mission.state.l3!.furthest, furthestAt: mission.state.l3!.furthestAt };
    const batches: { tick: number; afterLastAdvanceS: number; furthest: number; queued: { door: string; x: number; z: number; behindLineM: number; offscreen: boolean }[] }[] = [];
    const admissions: { tick: number; phase: string; batchTick: number | null; id: number; x: number; z: number; seen: boolean; behindLineM: number; pending: number; live: number }[] = [];
    const pending = mission.state.l3!.pending;
    const initialPressure = pending.filter(q => q.kind === 'pressure').map(q => ({ id: q.id, at: q.at }));
    const seenPressureIds = new Set(mission.state.l3!.pressureIds), independentAdmissions: { tick: number; phase: string; id: number }[] = [];
    const samples: { tick: number; phase: string; live: number; queued: number; pressureAt: number; furthest: number; furthestAt: number; x: number; z: number }[] = [];
    const known = new Set(pending.filter(q => q.kind === 'pressure')), admitted = new Set([...known].filter(q => q.id)), batchOwners = new Map<(typeof pending)[number], number>();
    let phase = 'backward';
    const observe = () => {
      const state = mission.state.l3!, p = world.entities.get(1)!.transform;
      samples.push({ tick: world.tick, phase, live: world.infected!.director.count, queued: state.pending.filter(q => q.kind === 'pressure' && !q.id).length, pressureAt: state.pressureAt, furthest: state.furthest, furthestAt: state.furthestAt, x: p.x, z: p.z });
      for (const id of state.pressureIds) if (!seenPressureIds.has(id)) { seenPressureIds.add(id); independentAdmissions.push({tick:world.tick,phase,id}); }
      if (state.pressureAt && !batches.some(batch => batch.tick === state.pressureAt)) batches.push({ tick: state.pressureAt,
        afterLastAdvanceS: (state.pressureAt - state.furthestAt) / 60, furthest: state.furthest,
        queued: state.pending.filter(q => q.kind === 'pressure' && !known.has(q)).map(q => {
          known.add(q); batchOwners.set(q, state.pressureAt); const at = mission.def.anchors[q.door];
          return { door: q.door, x: at.x, z: at.z, behindLineM: state.furthest - at.x, offscreen: world.infected!.director.offscreen(at) };
        }) });
      for (const q of state.pending) if (q.kind === 'pressure' && q.id && !admitted.has(q)) {
        admitted.add(q); admissions.push({ tick: world.tick, phase, batchTick: batchOwners.get(q) ?? null, id: q.id, x: q.x!, z: q.z!, seen: !!q.seen,
          behindLineM: state.furthest - q.x!, pending: state.pending.filter(p => p.kind === 'pressure' && !p.id).length, live: world.infected!.director.count });
      }
    };
    for (let i = 0; i < 60; i++) { tick({ ...emptyInput(), move: { x: -1, z: 0 } }); observe(); }
    const holdStart = { tick: world.tick, player: { ...world.entities.get(1)!.transform } };
    phase = 'hold';
    for (let i = 0; i < 36 * 60; i++) { tick(emptyInput()); observe(); }
    const afterHold = { tick: world.tick, player: { ...world.entities.get(1)!.transform }, pending: mission.state.l3!.pending.filter(q => q.kind === 'pressure' && !q.id).length };
    const target = { x: start.furthest + 6, z: start.player.z }, route = { path: [] as number[], goal: -1, pathIndex: 0 }, next = { x: 0, z: 0 };
    phase = 'advance';
    let resumed: { tick: number; player: { x: number; z: number }; pressureAt: number; queued: number } | null = null;
    for (let i = 0; i < 20 * 60; i++) {
      const p = world.entities.get(1)!.transform;
      if (p.x > start.furthest + 1) { resumed = { tick: world.tick, player: { ...p }, pressureAt: mission.state.l3!.pressureAt, queued: mission.state.l3!.pending.filter(q => q.kind === 'pressure' && !q.id).length }; break; }
      const clear = world.infected!.nav.forPlayer(.35).steer(p, target, route, .35, next, Infinity, true);
      const dx = next.x - p.x, dz = next.z - p.z, d = Math.hypot(dx, dz) || 1;
      tick({ ...emptyInput(), move: clear ? { x: dx / d, z: dz / d } : { x: 0, z: 0 } }); observe();
    }
    const windows = batches.filter(b => b.tick >= holdStart.tick && b.tick + 600 <= afterHold.tick).map(b => ({ tick: b.tick, seconds: 10,
      independentAdmissions: independentAdmissions.filter(a => a.phase === 'hold' && a.tick >= b.tick && a.tick < b.tick + 600).length,
      actualAdmissions: admissions.filter(a => a.phase === 'hold' && a.tick >= b.tick && a.tick < b.tick + 600).length }));
    return { line, tier, retirements, protected: true, countOnly: true, start, holdStart, afterHold, initialPressure, batches, admissions, independentAdmissions, samples, resumed, windows,
      queuedPass: batches.length >= 2 && batches.every(b => b.afterLastAdvanceS >= 20 && b.queued.length >= 25 && b.queued.length <= 75 && b.queued.every(q => q.behindLineM >= 15 && q.behindLineM <= 35 && q.offscreen)),
      stoppedOnAdvance: !!resumed && resumed.pressureAt === 0 && resumed.queued === 0 };
  } finally { world.dispose(); }
}

import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { provenance } from './accept/probe';
const runs = [];
for (const tier of ['low', 'high'] as const) for (const line of [0, 80]) {
  try { const result = await pressureAtLine(tier, line); runs.push(result); console.log(JSON.stringify({tier,line,windows:result.windows,queuedPass:result.queuedPass,stopped:result.stoppedOnAdvance})); }
  catch (error) { runs.push({ tier, line, error: String(error) }); console.log(tier,line,String(error)); }
}
writeFileSync(process.env.PRESSURE_PROOF_OUT??'docs/reports/fix60-a/L3-10-ledger.json.gz', gzipSync(JSON.stringify({ ...provenance(), runs })));

if (runs.some(run => !("windows" in run) || !run.windows.length || run.windows.some(window => window.actualAdmissions < 25 || window.actualAdmissions > 75 || window.actualAdmissions !== window.independentAdmissions) || !run.queuedPass || !run.stoppedOnAdvance)) process.exitCode = 1;
