import { l9Groups, l9Encounters } from '../../data/l9';
import type { SimWorld } from '../world/SimWorld';

export interface L9EncounterState { spawned: string[]; ids: Record<string, number[]>; patrol?: { nextAt: number; serial: number } }
export const emptyEncounters = (): L9EncounterState => ({ spawned: [], ids: {} });

/**
 * L9-E1: every authored group is created once, the first time its 100 m chunk becomes resident, using the existing
 * infected director pool/cap and the chunk residency for sleep/wake (ids, HP, corpses and timers survive revisits).
 * The state lives in the L9 mission snapshot, so checkpoints and saves neither respawn nor drop a group.
 */
export function updateEncounters(w: SimWorld, state: L9EncounterState): void {
  const ai = w.infected, chunks = w.chunks;
  if (!ai || !chunks || w.tick % 10 !== 0) return;
  // Every prescribed route retains its six/eight-member groups on both
  // tiers. The generic 15/7 town cap silently discarded later resident groups.
  const authored = l9Groups.reduce((n, g) => n + g.runners + g.alphas, 0);
  ai.director.levelCap = authored * 2;
  for (const g of l9Groups) {
    if (!chunks.resident(g.at[0], g.at[1])) continue;
    const ids = state.ids[g.id] ??= [];
    if (state.spawned.includes(g.id)) {
      if (ids.length === g.runners + g.alphas) continue;
      // Repair checkpoints written by the earlier partial-admission bug.
      state.spawned = state.spawned.filter(id => id !== g.id);
    }
    const place = (archetype: string, x: number, z: number): boolean => {
      const r = archetype === 'infected.alpha' ? .55 : .35;
      for (let d = 0; d <= 4; d += .5) for (let i = 0; i < (d ? 12 : 1); i++) {
        const px = x + Math.cos(i * Math.PI / 6) * d, pz = z + Math.sin(i * Math.PI / 6) * d;
        if (!ai.nav.clear(px, pz, r) || ai.director.count + 1 > ai.director.cap) continue;
        ids.push(ai.spawn(archetype, { x: px, z: pz }, { state: 'idle', yaw: Math.PI / 2 })); return true;
      }
      return false;
    };
    const cols = l9Encounters.columns, rows = Math.ceil(g.runners / cols);
    const members = [
      ...Array.from({ length: g.alphas }, (_, a) => ({ archetype: 'infected.alpha', x: g.at[0], z: g.at[1] + (a ? 3 : -3) })),
      ...Array.from({ length: g.runners }, (_, i) => ({ archetype: 'infected.runner',
        x: g.at[0] + (i % cols - (cols - 1) / 2) * l9Encounters.spacing,
        z: g.at[1] + (Math.floor(i / cols) - (rows - 1) / 2) * l9Encounters.spacing })),
    ];
    // A cap or blocked cell defers the remaining members; it cannot mark an
    // empty/partial group complete forever. Existing ids remain checkpointed.
    for (let i = ids.length; i < members.length; i++) {
      const p = members[i]; if (!place(p.archetype, p.x, p.z)) break;
    }
    if (ids.length === members.length) state.spawned.push(g.id);
  }
  // Free driving can miss all three fixed route traces, and a slow reversal
  // can outlast the once-only roadside groups. Small patrols fill quiet
  // driving intervals using the same pool, cap and offscreen placement
  // predicate. Authored risk groups/detours keep their identities.
  const patrol = state.patrol ??= { nextAt: w.tick + 300, serial: 0 };
  // Two staggered rows read as a pack entering the headlights, with room to
  // steer around either side. Reuse the same safe offscreen admission/cap.
  const patrolSize = 6;
  if (w.tick < patrol.nextAt || ai.director.count + patrolSize > ai.director.cap || ai.pool.length < patrolSize) return;
  const player = w.entities.get(1)!, active = w.vehicles?.active;
  const car = active == null ? undefined : w.entities.get(active);
  if (!car?.vehicle) return;
  if (ai.active.some(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && Math.hypot(e.transform.x - player.transform.x, e.transform.z - player.transform.z) < 40 && ai.director.inFrame(e.transform))) return;
  const heading = -car.transform.yaw + (car.vehicle.forwardSpeed < -.5 ? Math.PI : 0);
  for (const distance of [30, 40, 50, 60, 75, 90]) for (const offset of [0, .25, -.25, .6, -.6, 1, -1]) {
    const centre = { x: car.transform.x + Math.cos(heading + offset) * distance, z: car.transform.z + Math.sin(heading + offset) * distance };
    const side = heading + offset + Math.PI / 2;
    const group = [0, 1].flatMap(row => [-1, 0, 1].map(slot => ({
      x: centre.x + Math.cos(side) * slot * 1.4 + Math.cos(heading + offset) * row * 2.2,
      z: centre.z + Math.sin(side) * slot * 1.4 + Math.sin(heading + offset) * row * 2.2,
    })));
    if (group.some(at => !chunks.resident(at.x, at.z) || !ai.director.safe('infected.runner', at))) continue;
    const ids = group.map(at => ai.spawn('infected.runner', at, { state: 'chase' }));
    for (const id of ids) ai.pursueTarget(id, 1);
    state.ids[`crossing-patrol-${patrol.serial++}`] = ids;
    patrol.nextAt = w.tick + 480;
    return;
  }
}
