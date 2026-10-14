import { infectedDef } from '../../data/infected';
import { cure } from '../../levels/L10/district';
import { cureEncounters, cureEncounterSlots, cureMedkits } from '../../levels/L10/encounters';
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
      const region = cure.regions.find(r => r.id === group.region)!;
      // Spatial entry keeps the first-minute crash population at six even with high-tier seam prefetch.
      // Later threats are beyond the entrance pickup; walking past without interacting still reveals them.
      if (group.region !== 'crash-outskirts' && (w.missions.state.stats.time < 60 || player.transform.x < cure.anchors[region.checkpoint][0])) continue;
      for (const slot of cureEncounterSlots(group, ai.director.tier)) {
        if (this.state.spawned[slot.key] || !chunks.resident(slot.x, slot.z) || ai.director.count >= ai.director.cap || !ai.pool.length) continue;
        const radius = infectedDef(slot.archetype).radius;
        // Small deterministic search handles furniture without moving an encounter onto the alternative road.
        for (let attempt = 0; attempt < 17; attempt++) {
          const angle = attempt * Math.PI / 4, distance = Math.ceil(attempt / 8) * 1.5;
          const at = { x: slot.x + Math.cos(angle) * distance, z: slot.z + Math.sin(angle) * distance };
          if (!chunks.resident(at.x, at.z) || !ai.nav.clear(at.x, at.z, radius) || !ai.director.safe(slot.archetype, at)) continue;
          this.state.spawned[slot.key] = ai.spawn(slot.archetype, at, { state: 'idle', yaw: Math.PI,
            ...(slot.archetype === 'infected.alpha' ? { cureRegion: group.region } : {}) });
          break;
        }
      }
    }
  }
}
