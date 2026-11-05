import { emptyInput, type InputFrame } from '../../../src/input/InputFrame';
import { LevelThreeBot } from '../../../src/debug/bot/LevelThreeBot';
import { loadL3, followFrustum } from '../../sim-runner/l3Bots';
import type { Tier } from './probe';

/** Reach S1 through native inputs, step back, idle, then advance. Protection is count-only. */
export async function l3PressureProbe(tier: Tier) {
  const { world, mission } = await loadL3(1, tier);
  try {
    world.combat!.damage.god = true;
    const bot = new LevelThreeBot(world, 'complete', 'auto');
    const tick = (frame: InputFrame) => { followFrustum(world); world.applyInput(frame, 'keyboard'); world.update(); };
    while (world.tick < 600 * 60 && !(mission.state.l3!.phase === 'corridor' && world.entities.get(1)!.transform.x >= -80)) tick(bot.sample());
    if (mission.state.l3!.phase !== 'corridor' || world.entities.get(1)!.transform.x < -80) throw new Error('Pressure probe did not reach S1 by ordinary input');
    const start = { tick: world.tick, player: { ...world.entities.get(1)!.transform }, furthest: mission.state.l3!.furthest, furthestAt: mission.state.l3!.furthestAt };
    const batches: { tick: number; afterLastAdvanceS: number; furthest: number; queued: { door: string; x: number; z: number; behindLineM: number; offscreen: boolean }[] }[] = [];
    const admissions: { tick: number; phase: string; batchTick: number | null; id: number; x: number; z: number; seen: boolean; behindLineM: number; pending: number; live: number }[] = [];
    const pending = mission.state.l3!.pending;
    const known = new Set(pending.filter(q => q.kind === 'pressure')), admitted = new Set(known), batchOwners = new Map<(typeof pending)[number], number>();
    let phase = 'backward';
    const observe = () => {
      const state = mission.state.l3!;
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
      actualAdmissions: admissions.filter(a => a.phase === 'hold' && a.tick >= b.tick && a.tick < b.tick + 600).length }));
    return { tier, protected: true, countOnly: true, start, holdStart, afterHold, batches, admissions, resumed, windows,
      queuedPass: batches.length >= 2 && batches.every(b => b.afterLastAdvanceS >= 20 && b.queued.length >= 25 && b.queued.length <= 75 && b.queued.every(q => q.behindLineM >= 15 && q.behindLineM <= 35 && q.offscreen)),
      stoppedOnAdvance: !!resumed && resumed.pressureAt === 0 && resumed.queued === 0 };
  } finally { world.dispose(); }
}
