import { updateFarmScares, type FarmScareState } from './FarmScares';
import { cure } from '../../levels/L10/district';
import { cureEncounters, cureEncounterSlots, cureEncounterSpot, cureMedkits, cureWeaponPickups } from '../../levels/L10/encounters';
import { cureAlphaCap } from '../../levels/L10/alphaContracts';
import { insideCureHangar } from '../../data/l10Story';
import type { SimWorld } from '../world/SimWorld';

export interface CureEncounterState {
  farmScares?: FarmScareState;
  spawned: Record<string, number>; medkits: Record<string, number>; weapons?: Record<string, number>;
  released?: string[]; laneOffsets?: Record<string, number>; assaultTicks?: number; assaultWave?: number; nextAssaultAt?: number;
}
/** Once-only moving hunters; bounded finale waves leave time to clear stairs and cool the gun. */
export class LevelTenEncounters {
  state: CureEncounterState = { spawned: {}, medkits: {}, weapons: {}, assaultTicks: 0 };
  constructor(private readonly world: SimWorld) {}
  snapshot(): CureEncounterState { return structuredClone(this.state); }
  restore(value: unknown): void {
    this.state = structuredClone(value as CureEncounterState); this.state.weapons ??= {};
    for (const [id, scare] of Object.entries(this.state.farmScares ?? {})) if (scare.actor === undefined) delete this.state.farmScares![id];
  }
  update(): void {
    const w = this.world, ai = w.infected, chunks = w.chunks, mission = w.missions;
    if (!ai || !chunks || mission?.state.phase !== 'playing' || mission.state.states['cure-released']) return;
    const assaultActive = !!mission.state.states['charge-active'] && !(mission.state.states['charge-ready'] && mission.state.states['mega-dead']);
    if (assaultActive) this.state.assaultTicks = (this.state.assaultTicks ?? 0) + 1;
    if (w.tick % 10 !== 0) return;
    const player = w.entities.get(1)!;
    const current = cure.regions.find(r => player.transform.x >= r.envelope[0][0] && player.transform.x <= r.envelope[1][0]) ?? cure.regions.at(-1)!;
    const low = ai.director.tier === 'low', depth = cure.threatDepth.find(r => r.region === current.id)!;
    const cap = assaultActive ? low ? 14 : 22 : depth.resident[low ? 'low' : 'high'][1];
    ai.director.levelCap = low ? cap * 2 : cap;
    const weapons = this.state.weapons ??= {};
    for (const pickup of cureWeaponPickups) {
      const at = cure.anchors[pickup.anchor];
      if (weapons[pickup.id] || !at || !chunks.resident(...at)) continue;
      weapons[pickup.id] = w.combat!.pickups.spawn(pickup.action, { x: at[0], z: at[1] }, false, { retain: true });
    }
    updateFarmScares(w, this.state.farmScares ??= {});

    for (const kit of cureMedkits) {
      if (this.state.medkits[kit.id] || !chunks.resident(...kit.at)) continue;
      this.state.medkits[kit.id] = w.pickups!.spawn('medkit', { x: kit.at[0], z: kit.at[1] });
    }
    // Authored groups retain ordinary attacks, but never lapse into an idle line ahead of an approaching courier.
    for (const e of ai.active) if (e.health.current > 0 && e.infected?.cureRegion && !e.infected.pursuit &&
      ['idle', 'wander'].includes(e.infected.state) && (e.infected.pressureTarget?.until ?? 0) <= w.tick &&
      Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 160) ai.pursueTarget(e.id, 1);
    const released = this.state.released ??= [], lanes = this.state.laneOffsets ??= {};
    for (const group of cureEncounters) {
      const assault = !!group.assault;
      if (assault && !assaultActive) continue;
      if (!assault && !released.includes(group.id)) {
        if (Math.abs(player.transform.x - group.at[0]) > 120) continue;
        released.push(group.id);
        // A field crossing meets the same once-only hunting group on its own lane. No group relocates after admission.
        lanes[group.id] = Math.abs(player.transform.z - group.at[1]) > 40 ? player.transform.z - group.at[1] : 0;
      }
      // A 30 s wave period, at most 5 s of admission, then 25 s with no new arrivals.
      // If a wave is still alive, postpone the next one until it has been cleared plus an 8 s breather.
      const clock = this.state.assaultTicks ?? 0;
      if (assault && clock >= (this.state.nextAssaultAt ?? 0)) {
        const living = Object.entries(this.state.spawned).filter(([key, id]) => key.startsWith('dispersal-assault:') && (w.entities.get(id)?.health.current ?? 0) > 0);
        if (living.length) this.state.nextAssaultAt = clock + 480;
        else { this.state.assaultWave = (this.state.assaultWave ?? -1) + 1; this.state.nextAssaultAt = clock + 1800; }
      }
      if (assault && clock < (this.state.nextAssaultAt ?? 1800) - 1800) continue;
      if (assault && clock - ((this.state.nextAssaultAt ?? 1800) - 1800) >= 300) continue;
      const wave = assault ? this.state.assaultWave ?? 0 : 0;
      const slots = cureEncounterSlots(group, ai.director.tier);
      for (const slot of slots) {
        const key = `${slot.key}:${wave}`;
        slot.z += lanes[group.id] ?? 0;
        if (this.state.spawned[key] || !ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns) continue;
        if (slot.archetype === 'infected.dog' && ai.active.filter(e => e.archetype === slot.archetype && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= (assault ? 4 : 2)) continue;
        if (slot.archetype === 'infected.alpha' && ai.active.filter(e => e.archetype === slot.archetype && !e.infected?.pursuit && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length >= cureAlphaCap(group.region, ai.director.tier)) continue;
        const at = cureEncounterSpot(ai.nav, slot, (x, z) => !insideCureHangar({ x, z }) && chunks.resident(x, z) && ai.director.safe(slot.archetype, { x, z }), assault ? 129 : 33);
        if (!at) continue;
        const id = ai.spawn(slot.archetype, at, { state: 'chase', yaw: Math.PI, cureRegion: group.region });
        this.state.spawned[key] = id;
        ai.pursueTarget(id, 1);
        if (assault) break; // Bounded actor setup per director tick.
      }
    }
  }
}
