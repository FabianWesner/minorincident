import { l9Groups, l9Encounters } from '../../data/l9';
import type { SimWorld } from '../world/SimWorld';

export interface L9EncounterState { spawned: string[]; ids: Record<string, number[]>; patrol?: { nextAt: number; serial: number } }
export const emptyEncounters = (): L9EncounterState => ({ spawned: [], ids: {} });

/** The engine is an audible moving destination even while the driver is hidden
 * inside the cab. Ordinary human targeting deliberately excludes seated people. */
export function pursueCrossingVehicle(w: SimWorld, id: number): void {
  const e = w.entities.get(id), car = w.vehicles?.active == null ? undefined : w.entities.get(w.vehicles.active);
  if (!e?.infected || !car || e.hidden || e.attachedTo !== undefined || e.health.current <= 0 || !w.entities.get(1)?.hidden) return;
  e.infected.scripted = { x: car.transform.x, z: car.transform.z }; e.infected.state = 'chase'; e.infected.heardTargetId = 0;
}

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
  for (const ids of Object.values(state.ids)) for (const id of ids) pursueCrossingVehicle(w, id);
  for (const g of l9Groups) {
    if (!chunks.resident(g.at[0], g.at[1])) continue;
    const ids = state.ids[g.id] ??= [];
    if (state.spawned.includes(g.id)) {
      if (ids.length === g.runners + g.alphas) continue;
      // Repair checkpoints written by the earlier partial-admission bug.
      state.spawned = state.spawned.filter(id => id !== g.id);
    }
    const car = w.vehicles?.active == null ? undefined : w.entities.get(w.vehicles.active);
    // Chunks load before they enter the camera. Admit a group while it is still
    // outside the zoomed-out driving view so its first visible pose is already
    // moving toward the engine noise instead of standing in a formation.
    if (!car || Math.hypot(g.at[0] - car.transform.x, g.at[1] - car.transform.z) < 105) continue;
    const place = (archetype: string, x: number, z: number): boolean => {
      for (let d = 0; d <= 4; d += .5) for (let i = 0; i < (d ? 12 : 1); i++) {
        const px = x + Math.cos(i * Math.PI / 6) * d, pz = z + Math.sin(i * Math.PI / 6) * d;
        const at = { x: px, z: pz };
        if (!ai.director.safe(archetype, at) || ai.director.count + 1 > ai.director.cap) continue;
        const id = ai.spawn(archetype, at, { state: 'chase', yaw: Math.atan2(car.transform.z - pz, car.transform.x - px) });
        ai.pursueTarget(id, 1); pursueCrossingVehicle(w, id);
        ids.push(id); return true;
      }
      return false;
    };
    const cols = l9Encounters.columns, rows = Math.ceil(g.runners / cols);
    const routeMix: Record<string, readonly string[]> = {
      road: ['infected.runner', 'infected.sprinter', 'infected.brute', 'infected.dog', 'infected.armored', 'infected.screamer'],
      countryside: ['infected.runner', 'infected.dog', 'infected.screamer', 'infected.firefighter', 'infected.sprinter', 'infected.bloated'],
      'dry-shortcut': ['infected.runner', 'infected.zebra', 'infected.dog', 'infected.sprinter', 'infected.elephant', 'infected.runner', 'infected.zebra', 'infected.dog'],
    };
    const mix = routeMix[g.route] ?? routeMix.road;
    const members = [
      ...Array.from({ length: g.alphas }, (_, a) => ({ archetype: 'infected.alpha', x: g.at[0], z: g.at[1] + (a ? 3 : -3) })),
      ...Array.from({ length: g.runners }, (_, i) => ({ archetype: mix[i % mix.length],
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
  const patrolTypes = ['infected.runner', 'infected.sprinter', 'infected.dog', 'infected.screamer', 'infected.brute', 'infected.runner'];
  const patrolSize = patrolTypes.length;
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
    if (Math.hypot(centre.x - car.transform.x, centre.z - car.transform.z) < 100 || group.some((at, index) => !chunks.resident(at.x, at.z) || !ai.director.safe(patrolTypes[index], at))) continue;
    const ids = group.map((at, index) => ai.spawn(patrolTypes[index], at, { state: 'chase' }));
    for (const id of ids) { ai.pursueTarget(id, 1); pursueCrossingVehicle(w, id); }
    state.ids[`crossing-patrol-${patrol.serial++}`] = ids;
    patrol.nextAt = w.tick + 480;
    return;
  }
}
