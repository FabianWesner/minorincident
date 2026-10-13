import { l9Groups, l9Encounters } from '../../data/l9';
import type { SimWorld } from '../world/SimWorld';

export interface L9EncounterState { spawned: string[]; ids: Record<string, number[]> }
export const emptyEncounters = (): L9EncounterState => ({ spawned: [], ids: {} });

/**
 * L9-E1: every authored group is created once, the first time its 100 m chunk becomes resident, using the existing
 * infected director pool/cap and the chunk residency for sleep/wake (ids, HP, corpses and timers survive revisits).
 * The state lives in the L9 mission snapshot, so checkpoints and saves neither respawn nor drop a group.
 */
export function updateEncounters(w: SimWorld, state: L9EncounterState): void {
  const ai = w.infected, chunks = w.chunks;
  if (!ai || !chunks || w.tick % 10 !== 0) return;
  for (const g of l9Groups) {
    if (state.spawned.includes(g.id) || !chunks.resident(g.at[0], g.at[1])) continue;
    const ids: number[] = [];
    const place = (archetype: string, x: number, z: number): void => {
      const r = archetype === 'infected.alpha' ? .55 : .35;
      for (let d = 0; d <= 4; d += .5) for (let i = 0; i < (d ? 12 : 1); i++) {
        const px = x + Math.cos(i * Math.PI / 6) * d, pz = z + Math.sin(i * Math.PI / 6) * d;
        if (!ai.nav.clear(px, pz, r) || ai.director.count + 1 > ai.director.cap) continue;
        ids.push(ai.spawn(archetype, { x: px, z: pz }, { state: 'idle', yaw: Math.PI / 2 })); return;
      }
    };
    for (let a = 0; a < g.alphas; a++) place('infected.alpha', g.at[0], g.at[1] + (a ? 3 : -3));
    const cols = l9Encounters.columns, rows = Math.ceil(g.runners / cols);
    for (let i = 0; i < g.runners; i++) place('infected.runner',
      g.at[0] + (i % cols - (cols - 1) / 2) * l9Encounters.spacing, g.at[1] + (Math.floor(i / cols) - (rows - 1) / 2) * l9Encounters.spacing);
    state.spawned.push(g.id); state.ids[g.id] = ids;
  }
}
