import { cureRadius } from '../../data/cureDust';
import { cureReached } from './CureFront';
import { cureAlphaCap, cureAlphaPopulation, cureRegularAlphaCount } from '../../levels/L10/alphaContracts';
import type { Mission } from './Mission';
import type { EntitySnapshot } from '../world/types';

export const epilogueTicks = 65 * 60;
export const pulloutTicks = 15 * 60;
export const titleTicks = 5 * 60;
export const creditsTicks = 90 * 60;
// Give residents individual walking routes and room to pause at each end,
// rather than keeping the small epilogue cast in a tight formation.
const survivorSpread = [
  [-5, -2], [-2.5, 3], [0, -4], [2.5, 1.5], [5, -2.5], [5, 3.5],
] as const;
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
    if (front.elapsed >= 8 * 60 && ending.phase !== 'done') this.mission.world.storyLock ??= { scripted: null, skip: false };
    if (ending.phase === 'playable') {
      this.cast();
      const elapsed = front.elapsed;
      if (elapsed >= 8 * 60) {
        if (this.mission.world.storyLock?.skip && this.canSkip) { front.elapsed = epilogueTicks; front.radius = cureRadius(front.elapsed); }
      }
      if (elapsed >= 30 * 60 && !state.states['epilogue-rosa']) {
        state.states['epilogue-rosa'] = true;
        const save = this.mission.world.progression?.campaign;
        const roster = save?.crossingHandover?.shelteredPassengers ?? save?.results?.L8?.escapedSurvivors ?? [];
        if (roster.some(e => e.civilian?.survivor?.key === 'rosa' && e.health.current > 0 && !e.infected && !e.infection)) this.mission.radio('L10.epilogue-rosa');
      }
      if (elapsed >= 37 * 60 && !state.states['epilogue-sam']) {
        state.states['epilogue-sam'] = true;
        this.mission.radio(state.states['sam-alive'] ? 'L10.epilogue-sam' : 'L10.epilogue-sam.reyes');
      }
      if (front.elapsed >= 50 * 60 && !state.states['delivery-notified']) {
        state.states['delivery-notified'] = true;
        this.mission.radio('L1.delivered');
        const corgi = this.mission.world.entities.values().find(e => !!e.companion);
        if (corgi) this.mission.world.events.emit({ type: 'corgi.bark', tick: this.mission.world.tick, id: corgi.id, threatId: 0, direction: { x: 1, z: 0 } });
      }
      if (front.elapsed >= epilogueTicks) {
        state.states['epilogue-finished'] = true;
        this.phase('title');
      }
    } else if (ending.phase === 'title' && ++ending.phaseTicks >= titleTicks) this.phase('credits');
    else if (ending.phase === 'credits' && ++ending.phaseTicks >= creditsTicks) this.phase('thanks');
    else if (ending.phase === 'thanks' && ++ending.phaseTicks >= 6 * 60) this.finish();
  }
  /** r31-epilogue: the release beat always has people to see. When the fight ended away from the
   * infected, a small authored cured crowd kneels around her (cower) and then follows the normal
   * cured routine (sit, look around, walk to her). Bodies are never moved; spawns keep clear of them. */
  gatherCured(): void {
    const { world: w, state } = this.mission, front = state.cureFront, npcs = w.npcs, nav = w.infected?.nav;
    if (!front || !npcs || !nav) return;
    const p = w.entities.get(1)!.transform, low = w.infected!.director.tier === 'low', desired = low ? 4 : 7;
    const near = (e: EntitySnapshot | undefined, r: number) => !!e && Math.hypot(e.transform.x - p.x, e.transform.z - p.z) < r;
    let present = front.affectedIds.filter(id => { const e = w.entities.get(id); return !!e?.civilian && e.health.current > 0 && near(e, 14); }).length;
    if (present >= desired) return;
    const megaId = w.megaPursuit?.state.id ?? 0;
    const bodies = [...w.entities.iterate()].filter(e => e.corpse || (e.health.current <= 0 && e.id !== 1)).filter(e => near(e, 20));
    const placed: { x: number; z: number }[] = [];
    const models = ['npc.civilian-man-a', 'npc.national-guard', 'npc.civilian-woman-a', 'npc.paramedic', 'npc.civilian-man-b', 'npc.civilian-woman-b', 'npc.national-guard'];
    for (let i = 0; i < 24 && present < desired; i++) {
      const angle = 2.2 + i * 2.39996, radius = 4.5 + (i % 4) * 1.4;
      const cell = nav.nearestCell(p.x + Math.cos(angle) * radius, p.z + Math.sin(angle) * radius, .35);
      if (cell < 0) continue;
      const at = { x: nav.x(cell), z: nav.z(cell) };
      if (!nav.clear(at.x, at.z, .4) || Math.hypot(at.x - p.x, at.z - p.z) < 2.5) continue;
      if (bodies.some(b => Math.hypot(b.transform.x - at.x, b.transform.z - at.z) < (b.id === megaId ? 5 : 1.8))) continue;
      if (placed.some(q => Math.hypot(q.x - at.x, q.z - at.z) < 1.6)) continue;
      const id = npcs.civilians.spawn('resident', at, { waypoints: [at], model: models[placed.length % models.length] });
      const c = w.entities.get(id)!.civilian!;
      // Same presentation as a cured infected: kneel, then stand into the cured routine.
      c.story = { clip: 'npc-cower', start: w.tick }; c.pauseUntil = w.tick + 90 + placed.length * 25;
      w.entities.get(id)!.transform.yaw = -Math.atan2(p.z - at.z, p.x - at.x);
      front.affectedIds.push(id); placed.push(at); present++;
    }
  }
  get canSkip(): boolean { return !!this.mission.world.progression?.campaign?.world?.infectionCleared?.epilogueSeen; }
  private phase(phase: 'title' | 'credits' | 'thanks' | 'done'): void {
    const { state, world } = this.mission;
    if (phase === 'title') { const cleared = world.progression?.campaign?.world?.infectionCleared; if (cleared) cleared.epilogueSeen = true; }
    state.epilogue!.phase = phase; state.epilogue!.phaseTicks = 0;
    world.events.emit({ type: 'mission.signal', tick: world.tick, name: `epilogue-${phase}` });
  }
  /** Existing credits skip/return controls complete the same once-only mission transaction. */
  finish(): void {
    if (!['credits', 'thanks'].includes(this.mission.state.epilogue?.phase ?? '')) return;
    const cleared = this.mission.world.progression?.campaign?.world?.infectionCleared;
    if (cleared) cleared.epilogueSeen = true;
    this.mission.world.storyLock = null;
    this.mission.state.states['credits-finished'] = true;
    this.phase('done');
  }
  skip(): void {
    if (this.mission.state.epilogue?.phase === 'credits') this.mission.state.epilogue.phaseTicks = creditsTicks;
    else if (this.canSkip && this.mission.state.epilogue?.phase === 'playable') {
      this.mission.state.cureFront!.elapsed = epilogueTicks; this.mission.state.cureFront!.radius = cureRadius(epilogueTicks);
    }
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
        const i = ending.survivors.length, [dx, dz] = survivorSpread[i];
        const cell = ai.nav.nearestCell(refuge.x + dx, refuge.z + dz, .35);
        const goalCell = ai.nav.nearestCell(walk.x + dx, walk.z + dz, .35);
        if (cell >= 0 && goalCell >= 0 && cell !== goalCell) {
          const at = { x: ai.nav.x(cell), z: ai.nav.z(cell) };
          const goal = { x: ai.nav.x(goalCell), z: ai.nav.z(goalCell) };
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
