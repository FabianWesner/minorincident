import { cureReached } from './CureFront';
import { cureAlphaCap, cureAlphaPopulation, cureRegularAlphaCount } from '../../levels/L10/alphaContracts';
import type { Mission } from './Mission';

export const epilogueTicks = 150 * 60;
export const pulloutTicks = 36 * 60;
export const titleTicks = 5 * 60;
export const creditsTicks = 12 * 60;
/** Smooth release-relative pull, independent of frame rate and restored clocks. */
export function epiloguePull(ticks: number): number {
  const t = Math.max(0, Math.min(1, (ticks - (epilogueTicks - pulloutTicks)) / pulloutTicks));
  return t * t * (3 - 2 * t);
}

/** Small authored cast on the existing civilian/director/nav systems; no recurring post-release spawner. */
export class LevelTenEpilogue {
  constructor(private readonly mission: Mission) {}
  update(): void {
    const { state } = this.mission;
    const front = state.cureFront;
    if (!front) return;
    const ending = state.epilogue ??= { phase: 'playable', phaseTicks: 0, survivors: [], approaching: [], groupsAuthored: false };
    state.counters['epilogue-ticks'] = Math.min(epilogueTicks, front.elapsed);
    if (ending.phase === 'playable') {
      this.cast();
      if (front.elapsed >= epilogueTicks) {
        state.states['epilogue-finished'] = true;
        this.phase('title');
      }
    } else if (ending.phase === 'title' && ++ending.phaseTicks >= titleTicks) this.phase('credits');
    else if (ending.phase === 'credits' && ++ending.phaseTicks >= creditsTicks) this.finish();
  }
  private phase(phase: 'title' | 'credits' | 'done'): void {
    const { state, world } = this.mission;
    state.epilogue!.phase = phase; state.epilogue!.phaseTicks = 0;
    world.events.emit({ type: 'mission.signal', tick: world.tick, name: `epilogue-${phase}` });
  }
  /** Existing credits skip/return controls complete the same once-only mission transaction. */
  finish(): void {
    if (this.mission.state.epilogue?.phase !== 'credits') return;
    this.mission.state.states['credits-finished'] = true;
    this.phase('done');
  }
  skip(): void {
    if (this.mission.state.epilogue?.phase === 'credits') this.mission.state.epilogue.phaseTicks = creditsTicks;
  }
  private cast(): void {
    const { world: w, state, def } = this.mission;
    const ending = state.epilogue!, ai = w.infected, npcs = w.npcs;
    if (!ai || !npcs) return;
    const low = ai.director.tier === 'low';
    const refuge = def.anchors['epilogue-survivors'], walk = def.anchors['epilogue-walk'];
    // These anchors already belong to D4. Custom arenas may omit them entirely.
    if (refuge && walk && ending.survivors.length < (low ? 3 : 6) && Math.hypot(refuge.x - walk.x, refuge.z - walk.z) > 4 && cureReached(state.cureFront!, refuge) && state.cureFront!.elapsed >= 12 * 60) {
      const desired = Math.min(low ? 3 : 6, 1 + Math.floor((state.cureFront!.elapsed - 12 * 60) / (6 * 60)));
      const healthy = [...w.entities.iterate()].filter(e => e.civilian && !e.corpse && !e.hidden).length;
      if (ending.survivors.length < desired && healthy < (low ? 12 : 24) && (!w.chunks || w.chunks.resident(refuge.x, refuge.z))) {
        const i = ending.survivors.length;
        const cell = ai.nav.nearestCell(refuge.x + i % 3 * 1.3, refuge.z + Math.floor(i / 3) * 1.3, .35);
        if (cell >= 0) {
          const at = { x: ai.nav.x(cell), z: ai.nav.z(cell) };
          const goal = { x: walk.x + i % 3 * 1.3, z: walk.z + Math.floor(i / 3) * 1.3 };
          if (ai.nav.clear(goal.x, goal.z, .35)) ending.survivors.push(npcs.civilians.spawn('resident', at, { waypoints: [goal, at] }));
        }
      }
    }
    const approach = def.anchors['epilogue-approach'];
    if (!ending.groupsAuthored && approach && state.cureFront!.elapsed >= 120 && ai.pool.length && ai.director.count < ai.director.cap - ai.director.reserved
      && Math.hypot(approach.x - state.cureFront!.fronts[0].x, approach.z - state.cureFront!.fronts[0].z) > 25) {
      if (w.chunks && !w.chunks.resident(approach.x, approach.z)) return;
      ending.groupsAuthored = true;
      const kinds = low ? ['infected.runner', 'infected.dog', 'infected.alpha'] : ['infected.runner', 'infected.runner', 'infected.dog', 'infected.alpha', 'infected.runner', 'infected.dog'];
      for (const [i, kind] of kinds.entries()) {
        if (!ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved) break;
        if (kind === 'infected.alpha' && w.scenario === 'L10' && cureRegularAlphaCount(cureAlphaPopulation(w), 'dispersal-complex') >= cureAlphaCap('dispersal-complex', ai.director.tier)) continue;
        const cell = ai.nav.nearestCell(approach.x + i % 3 * 2, approach.z + Math.floor(i / 3) * 2, 1);
        if (cell < 0) continue;
        const at = { x: ai.nav.x(cell), z: ai.nav.z(cell) };
        if (ai.director.safe(kind, at)) ending.approaching.push(ai.spawn(kind, at, { state: 'chase', ...(kind === 'infected.alpha' && w.scenario === 'L10' ? { cureRegion: 'dispersal-complex' } : {}) }));
      }
      // A restored late fixture must never show a living actor behind the front.
      this.mission.l10!.cure.apply();
    }
  }
}
