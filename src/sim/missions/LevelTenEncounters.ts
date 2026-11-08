import { cure } from '../../levels/L10/district';
import { cureEncounters, cureEncounterSlots, cureEncounterSpot, cureMedkits } from '../../levels/L10/encounters';
import { cureAlphaCap } from '../../levels/L10/alphaContracts';
import type { SimWorld } from '../world/SimWorld';

export interface CureEncounterState { spawned: Record<string, number>; medkits: Record<string, number>; released?: string[]; laneOffsets?: Record<string, number>; patrol?: { nextSeconds: number; serial: number } }
/** Existing director owns cap/pool/safe placement; existing chunks own actor/pickup sleep and wake.
 * Road groups are once-only. The charging console draws fresh assault ranks every ten charge seconds. */
export class LevelTenEncounters {
  state: CureEncounterState = { spawned: {}, medkits: {} };
  private assaultSlots: { key: string; slots: ReturnType<typeof cureEncounterSlots> } | null = null;
  constructor(private readonly world: SimWorld) {}
  snapshot(): CureEncounterState { return structuredClone(this.state); }
  restore(value: unknown): void { this.state = structuredClone(value as CureEncounterState); }
  update(): void {
    const w = this.world, ai = w.infected, chunks = w.chunks;
    if (!ai || !chunks || w.missions?.state.phase !== 'playing' || w.missions.state.states['cure-released']) return;
    const directorTick = w.tick % 10 === 0;
    const charging = !!w.missions.state.states['charge-active'] && !w.missions.state.states['charge-ready'];
    if (!directorTick && !charging) return;
    const player = w.entities.get(1)!;
    // The generic town cap (15 high / 7 low) starves these once-only
    // encounters. Use the authored budget of the region the courier occupies,
    // including its special infected and the continuously pursuing Mega.
    const current = cure.regions.find(r => player.transform.x >= r.envelope[0][0] && player.transform.x <= r.envelope[1][0]) ?? cure.regions.at(-1)!;
    const depth = cure.threatDepth.find(r => r.region === current.id)!;
    const low = ai.director.tier === 'low';
    // Later-region resident bounds already include dogs and regular Alphas.
    // R2 alone specifies its dogs in addition to the regular-human range.
    const resident = depth.resident[low ? 'low' : 'high'][1];
    const cap = resident + (current.id === 'residential-fringe' ? depth.dogs?.[1] ?? 0 : 0);
    ai.director.levelCap = low ? cap * 2 : cap;

    for (const kit of cureMedkits) {
      if (this.state.medkits[kit.id] || !chunks.resident(...kit.at)) continue;
      this.state.medkits[kit.id] = w.pickups!.spawn('medkit', { x: kit.at[0], z: kit.at[1] });
    }
    // A charge wave can contain many fresh ranks. Admit one on each sim tick
    // so actor/material setup is spread across frames without changing slots.
    let assaultAdmissions = 0;
    for (const group of cureEncounters) {
      const assault = group.assault === true, corridorPatrol = group.id.startsWith('corridor-pack-');
      const directPatrol = group.id.includes('-direct-');
      if (!assault && !directorTick) continue;
      const corridorHorde = ['corridor-line', 'corridor-breach', 'corridor-exit'].includes(group.id);
      if (assault && !w.missions.state.states['charge-active']) continue;
      if (assault && w.missions.state.states['charge-ready']) continue;
      // Retain the full authored assault budget once charging starts.
      if (assault) ai.director.levelCap = 190;
      const region = cure.regions.find(r => r.id === group.region)!;
      // Spatial entry keeps the first-minute crash population at six even with high-tier seam prefetch.
      // Later threats are beyond the entrance pickup; walking past without interacting still reveals them.
      if (!assault && group.region !== 'crash-outskirts' && (w.missions.state.stats.time < 60 || player.transform.x < cure.anchors[region.checkpoint][0])) continue;
      // A fixed approach trigger releases each authored encounter once.
      // Sector prefetch alone must not send every later group down the road
      // as one distant firing line; placement and off-camera admission stay fixed.
      const released = this.state.released ??= [];
      const at = low ? group.atLow ?? group.at : group.at;
      if (!assault && !released.includes(group.id)) {
        // The authored road already has its own formations. Only intercept a
        // field crossing; do not move the shortcut patrols onto that road.
        const directCrossing = directPatrol && !region.route.some((b, i, route) => {
          if (!i) return false;
          const a = route[i - 1], dx = b[0] - a[0], dz = b[1] - a[1];
          const length = dx * dx + dz * dz;
          const t = length ? Math.max(0, Math.min(1, ((player.transform.x - a[0]) * dx + (player.transform.z - a[1]) * dz) / length)) : 0;
          return Math.hypot(player.transform.x - a[0] - t * dx, player.transform.z - a[1] - t * dz) <= 25;
        });
        const approach = corridorPatrol || corridorHorde || directCrossing ? Math.abs(player.transform.x - at[0]) : Math.hypot(player.transform.x - at[0], player.transform.z - at[1]);
        // The wide approach camera already sees a station at 40 m. Release
        // these fixed R7 groups while they are still ahead and offscreen;
        // otherwise they are only admitted after the courier passes them.
        // A legal field crossing can miss the patrol's old circular trigger.
        // Release its once-only station ahead of that crossing, while safe()
        // still prevents visible arrivals. Retain the lane across retries.
        const releaseM = group.id.startsWith('complex-approach-') ? 120 : directCrossing ? 80 : 40;
        if (group.releaseWith ? !released.includes(group.releaseWith) : approach > releaseM) continue;
        released.push(group.id);
        if (corridorPatrol || corridorHorde || directCrossing) (this.state.laneOffsets ??= {})[group.id] = player.transform.z - (corridorHorde ? 95 : at[1]);
      }
      // At each fixed depth, intercept the road or parallel forecourt that
      // the courier actually enters. Save the lane once, retaining the three
      // hordes' relative spacing, counts and deferred slots on retry. Legacy
      // released groups keep their original lane; admitted actors never move.
      const lane = this.state.laneOffsets?.[group.id] ?? 0;
      // A single opening salvo could exhaust the whole assault halfway through
      // charging. Fresh ranks use the same fixed approaches and concurrent cap;
      // the checkpointed slot ledger prevents duplicate admissions on retry.
      const wave = assault ? Math.min(5, Math.floor(w.missions.state.counters['charge-ticks'] / 600)) : 0;
      const slotKey = `${group.id}:${ai.director.tier}:${wave}:${lane}`;
      let slots = assault && this.assaultSlots?.key === slotKey ? this.assaultSlots.slots : null;
      if (!slots) {
        slots = cureEncounterSlots(group, ai.director.tier);
        if (lane) for (const slot of slots) slot.z += lane;
        if (wave) for (const slot of slots) slot.key += `:wave-${wave}`;
        // Boundary overlap can leave only a few slots: admit mixed threats first.
        // At low tier, reserve the corridor Alpha's approach before the regular rank,
        // then defer dogs while that rank fills the shared regional budget.
        // An early patrol dog otherwise leaves only 19 regular slots; putting
        // every regular first instead loses the concurrent Alpha overlap.
        const priority = (archetype: string) => corridorHorde && low
          ? archetype === 'infected.alpha' ? 0 : archetype === 'infected.runner' ? 1 : 2
          : Number(archetype === 'infected.runner');
        slots.sort((a, b) => priority(a.archetype) - priority(b.archetype));
        // Per-tick admission must not allocate and sort a whole wave every tick.
        if (assault) this.assaultSlots = { key: slotKey, slots };
      }
      for (const slot of slots) {
        if (assault && assaultAdmissions >= 1) break;
        if (this.state.spawned[slot.key] || !chunks.resident(slot.x, slot.z) || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns || !ai.pool.length) continue;
        if (group.region === 'residential-fringe' && !slot.archetype.includes('dog') && !slot.archetype.includes('alpha')) {
          const limit = cure.threatDepth.find(r => r.region === group.region)!.resident[low ? 'low' : 'high'][1];
          const living = ai.active.filter(e => !e.archetype.includes('dog') && !e.archetype.includes('alpha') && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length;
          if (living >= limit) continue;
        }
        if (slot.archetype === 'infected.dog') {
          const limit = cure.threatDepth.find(r => r.region === group.region)?.dogs?.[1] ?? 4;
          // The long destroyed corridor has a local dog budget: dogs still
          // outside its envelope cannot reserve the authored corridor packs.
          // Count every visitor and recoverable body once it enters the region.
          const local = group.region === 'destroyed-corridor' && !low;
          const living = ai.active.filter(e => e.archetype === 'infected.dog' &&
            (!local || e.transform.x >= region.envelope[0][0] && e.transform.x <= region.envelope[1][0] &&
              e.transform.z >= region.envelope[0][1] && e.transform.z <= region.envelope[1][1]) &&
            (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length;
          if (living >= limit) continue;
        }
        if (slot.archetype === 'infected.alpha') {
          const limit = cureAlphaCap(group.region, ai.director.tier);
          // A surviving Alpha follows the courier across region boundaries.
          // Keep its place in the next encounter's concurrent budget; defer
          // new once-only slots until combat frees space, as for dog packs.
          const living = ai.active.filter(e => e.archetype === 'infected.alpha' && !e.infected?.pursuit && (e.health.current > 0 || (e.infected?.recoverAt ?? -1) >= 0)).length;
          if (living >= limit) continue;
        }
        const at = cureEncounterSpot(ai.nav, slot, (x, z) => chunks.resident(x, z) && ai.director.safe(slot.archetype, { x, z }), assault ? 129 : 17);
        if (at) {
          // Once-only authored arrivals advance rather than waiting to be shot
          // from beyond their sight range. No replenishment follows the courier.
          this.state.spawned[slot.key] = ai.spawn(slot.archetype, at, { state: 'chase', yaw: Math.PI,
            cureRegion: group.region });
          if (assault) assaultAdmissions++;
          // A cap can admit a released member after the courier has passed.
          // Preserve that once-only encounter's ordinary pursuit as it arrives.
          ai.pursueTarget(this.state.spawned[slot.key], 1);
        }
      }
    }
    // A player can skirt the ruined road through either open forecourt.
    // Keep those quiet crossings populated without admitting another horde
    // or changing the authored regional cap. Stats time survives Resume.
    if (current.id !== 'destroyed-corridor') return;
    const patrol = this.state.patrol ??= { nextSeconds: w.missions.state.stats.time + 5, serial: 0 };
    if (w.missions.state.stats.time < patrol.nextSeconds || !ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns) return;
    // A distant visible straggler cannot engage a running courier and must
    // not suppress the next patrol. Keep the wait while combat is close.
    if (ai.active.some(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 12 && ai.director.inFrame(e.transform))) return;
    // Wide road framing can include every old 30–50 m candidate. Search
    // farther ahead too, so safe off-camera arrivals can intercept the real
    // route at either zoom instead of silently refusing every patrol.
    // r9-l10pace (vqa-4/vqa58: "0 infected near the courier" over minutes of corridor): a lone runner every 12 s read
    // as "a single infected now and then". Each patrol is a small pack (3 high / 2 low) under the same regional cap.
    const pack = low ? 2 : 3;
    for (const distance of [30, 40, 50, 65, 80, 100]) for (const offset of [.25, -.25, .6, -.6, 1, -1, Math.PI]) {
      const at = { x: player.transform.x + Math.cos(offset) * distance, z: player.transform.z + Math.sin(offset) * distance };
      if (!chunks.resident(at.x, at.z) || !ai.director.safe('infected.runner', at)) continue;
      for (let k = 0; k < pack; k++) {
        if (k && (!ai.pool.length || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns)) break;
        const spot = k ? { x: at.x + Math.cos(k * 2.4) * 1.6, z: at.z + Math.sin(k * 2.4) * 1.6 } : at;
        if (k && (!chunks.resident(spot.x, spot.z) || !ai.director.safe('infected.runner', spot) || !ai.nav.clear(spot.x, spot.z, .4))) continue;
        const id = ai.spawn('infected.runner', spot, { state: 'chase', cureRegion: current.id });
        ai.pursueTarget(id, 1);
        this.state.spawned[`corridor-wanderer-${patrol.serial++}`] = id;
      }
      patrol.nextSeconds = w.missions.state.stats.time + 12;
      return;
    }
  }
}
