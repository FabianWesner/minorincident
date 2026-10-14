import { cure } from '../../levels/L10/district';
import { cureEncounters, cureEncounterSlots, cureEncounterSpot, cureMedkits } from '../../levels/L10/encounters';
import type { SimWorld } from '../world/SimWorld';

export interface CureEncounterState { spawned: Record<string, number>; medkits: Record<string, number> }
/** Existing director owns cap/pool/safe placement; existing chunks own actor/pickup sleep and wake.
 * Only the once-only slot ledger is additional checkpoint state. No recurring waves or inventory predicates. */
export class LevelTenEncounters {
  state: CureEncounterState = { spawned: {}, medkits: {} };
  constructor(private readonly world: SimWorld) {}
  snapshot(): CureEncounterState { return structuredClone(this.state); }
  restore(value: unknown): void { this.state = structuredClone(value as CureEncounterState); }
  update(): void {
    const w = this.world, ai = w.infected, chunks = w.chunks;
    if (!ai || !chunks || w.missions?.state.phase !== 'playing' || w.missions.state.states['cure-released'] || w.tick % 10) return;
    const player = w.entities.get(1)!;
    for (const kit of cureMedkits) {
      if (this.state.medkits[kit.id] || !chunks.resident(...kit.at)) continue;
      this.state.medkits[kit.id] = w.pickups!.spawn('medkit', { x: kit.at[0], z: kit.at[1] });
    }
    for (const group of cureEncounters) {
      const assault = group.region === 'dispersal-complex';
      if (assault && !w.missions.state.states['charge-active']) continue;
      const region = cure.regions.find(r => r.id === group.region)!;
      // Spatial entry keeps the first-minute crash population at six even with high-tier seam prefetch.
      // Later threats are beyond the entrance pickup; walking past without interacting still reveals them.
      if (!assault && group.region !== 'crash-outskirts' && (w.missions.state.stats.time < 60 || player.transform.x < cure.anchors[region.checkpoint][0])) continue;
      const slots = cureEncounterSlots(group, ai.director.tier);
      // Boundary overlap can leave only a few slots: admit the mixed threats before filling with regulars.
      if (assault) slots.sort((a, b) => Number(a.archetype === 'infected.runner') - Number(b.archetype === 'infected.runner'));
      for (const slot of slots) {
        if (this.state.spawned[slot.key] || !chunks.resident(slot.x, slot.z) || ai.director.count >= ai.director.cap - ai.director.reserved - ai.director.pendingTurns || !ai.pool.length) continue;
        const at = cureEncounterSpot(ai.nav, slot, (x, z) => chunks.resident(x, z) && ai.director.safe(slot.archetype, { x, z }), assault ? 129 : 17);
        if (at) {
          this.state.spawned[slot.key] = ai.spawn(slot.archetype, at, { state: assault ? 'chase' : 'idle', yaw: Math.PI,
            ...(slot.archetype === 'infected.alpha' ? { cureRegion: group.region } : {}) });
        }
      }
    }
  }
}
