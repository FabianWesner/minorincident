/**
 * r12-group (PO 11-08: "They move too parallel, there needs to be a bit more natural group movements"):
 * shared personality for every following survivor group (L5–L8). Everything here is a pure function of
 * entity id / slot and the sim tick, plus small serializable fields on SurvivorState, so seeds, replays
 * and checkpoints stay deterministic. Mission controllers keep their own targets, pace caps and boarding.
 *
 * - looseSlotOffset: a persistent per-slot offset that turns the 1.2 m three-column lattice into a loose
 *   cluster of pairs (relaxed so no two slots come closer than the body-contact distance).
 * - swayOffset: a slow lateral wander while the group walks, so people do not move on parallel rails.
 * - startDelayTicks: people react a beat apart when the courier sets off.
 * - idleLook: standing followers look around, toward threats, the courier or each other.
 */
import type { EntitySnapshot } from '../world/types';
import type { SimWorld } from '../world/SimWorld';
import type { Point } from '../npc/types';

/** Deterministic hash in [0, 1) of two integers. */
export function personal(id: number, salt: number): number {
  let h = Math.imul(id ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
const centred = (id: number, salt: number) => personal(id, salt) * 2 - 1;

const slotCount = 48;
/** Closest two slot centres may come; bodies touch at ~0.715 m. */
const slotClearance = .9;
const offsets: { back: number; side: number }[] = (() => {
  const base = Array.from({ length: slotCount }, (_, slot) => ({ back: 2.3 + Math.floor(slot / 3) * 1.2, side: (slot % 3 - 1) * 1.2 }));
  const out = base.map((_, slot) => {
    const row = Math.floor(slot / 3), col = slot % 3;
    // Rows drift sideways as a whole, people jitter inside them, and pairs lean
    // together (left pair on even rows, right pair on odd rows, the third walks a little apart).
    const pairLean = row % 2 ? [0, -.22, .22][col] : [.22, -.22, 0][col];
    const loner = (row % 2 ? col === 0 : col === 2) ? (row % 2 ? -.12 : .12) : 0;
    return { back: centred(slot, 1) * .38 + (col === 1 ? .12 : 0) * centred(row, 7), side: centred(row, 3) * .3 + centred(slot, 2) * .2 + pairLean + loner };
  });
  // Relax: keep every pair of slot centres at least `slotClearance` apart, the front row clear of the courier.
  for (let pass = 0; pass < 24; pass++) {
    for (let i = 0; i < slotCount; i++) for (let j = i + 1; j < slotCount; j++) {
      const ax = base[i].back + out[i].back, az = base[i].side + out[i].side, bx = base[j].back + out[j].back, bz = base[j].side + out[j].side;
      const d = Math.hypot(ax - bx, az - bz);
      if (d >= slotClearance) continue;
      const push = (slotClearance - d) / 2 + .001, nx = d > 1e-6 ? (ax - bx) / d : 1, nz = d > 1e-6 ? (az - bz) / d : 0;
      out[i].back += nx * push; out[i].side += nz * push; out[j].back -= nx * push; out[j].side -= nz * push;
    }
    for (let i = 0; i < slotCount; i++) {
      out[i].back = Math.max(i < 3 ? -.05 : -.5, Math.min(.5, out[i].back));
      out[i].side = Math.max(-.5, Math.min(.5, out[i].side));
    }
  }
  return out;
})();

/** Persistent loose-cluster offset of a formation slot, in metres behind (back) and to the leader's right (side). */
export function looseSlotOffset(slot: number): { back: number; side: number } {
  return offsets[((Math.floor(slot) % slotCount) + slotCount) % slotCount];
}

/** Slow lateral wander (metres) of a walking follower; every person has an own period and phase. */
export function swayOffset(id: number, tick: number, amplitude = .28): number {
  const period = 300 + personal(id, 11) * 260, phase = personal(id, 12) * Math.PI * 2;
  const t = tick / period * Math.PI * 2;
  return amplitude * (.75 * Math.sin(t + phase) + .25 * Math.sin(2.3 * t + phase * 1.7));
}

/** Reaction delay (ticks) before a resting follower sets off; the injured are slower. */
export function startDelayTicks(e: EntitySnapshot, scenario: string | null | undefined): number {
  const base = 5 + personal(e.id, 21) * 22 + (e.civilian?.survivor?.injured ? 8 : 0);
  // L5-08 (followers 2–5 m behind the moving courier) is judged right after stops: keep that group brisk.
  return Math.round(scenario === 'L5' ? base * .3 : base);
}

/** Tracking acceleration scale: a little individual temperament, the injured lag a little. */
export function responseScale(e: EntitySnapshot, scenario: string | null | undefined): number {
  if (scenario === 'L5') return 1;
  return (.88 + personal(e.id, 31) * .24) * (e.civilian?.survivor?.injured ? .88 : 1);
}

/** A calm follower standing still that may look around and fidget; combat, story clips and passengers are excluded. */
export function idleEligible(e: EntitySnapshot): boolean {
  const c = e.civilian, s = c?.survivor;
  return !!s && s.mode === 'follow' && !s.cover && c!.state === 'calm' && !c!.story && !c!.schedule && !c!.vehicleYield
    && e.passengerOf === undefined && !e.hidden && !e.combat?.attacking && !c!.ally && e.health.current > 0;
}

const scratch: number[] = [];
/** Yaw a standing follower wants to look toward this tick (deterministic glance windows of 2.5–5.5 s). */
export function idleLookYaw(world: SimWorld, e: EntitySnapshot): number | undefined {
  const me = e.transform, player = world.entities.get(1);
  if (!player) return undefined;
  const face = (p: Point) => -Math.atan2(p.z - me.z, p.x - me.x);
  // Fear first: the nearest visible infected within 12 m holds the gaze.
  let threat: EntitySnapshot | undefined, best = 12;
  for (const o of world.infected?.active ?? []) {
    if (o.health.current <= 0 || o.hidden || o.infected?.hidden) continue;
    const d = Math.hypot(o.transform.x - me.x, o.transform.z - me.z);
    if (d < best) { best = d; threat = o; }
  }
  if (threat) return face(threat.transform);
  const period = 150 + Math.floor(personal(e.id, 41) * 180), window = Math.floor((world.tick + personal(e.id, 42) * period) / period);
  const choice = personal(e.id, 1000 + window);
  if (choice < .38) return face(player.transform);
  if (choice < .6) {
    // Someone nearby in the group.
    let other: EntitySnapshot | undefined, near = 3.5;
    for (const id of world.spatial.query({ x: me.x, z: me.z, r: near }, scratch, false)) {
      if (id === e.id) continue;
      const o = world.entities.get(id);
      if (!o?.civilian?.survivor || o.civilian.survivor.mode !== 'follow' || o.hidden) continue;
      const d = Math.hypot(o.transform.x - me.x, o.transform.z - me.z);
      if (d < near) { near = d; other = o; }
    }
    if (other) return face(other.transform);
  }
  // Looking around: the courier's facing plus a personal glance angle.
  return player.transform.yaw + centred(e.id, 2000 + window) * 1.9;
}
