import type { InputFrame } from '../../input/InputFrame';
import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';
import type { Walker } from './Walker';

/** Shared control mechanics of the level bots (L2-L5): threat selection, strike/walk frames, medkit choice and stuck bookkeeping.
 * The level-specific decision trees stay in each bot. */
export type P = { x: number; z: number };
export const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z);
/** Bookkeeping of a jammed walker: where it stood at the last check and for how many checks. */
export interface Stuck { at: P | null; n: number; next: number }
export const newStuck = (): Stuck => ({ at: null, n: 0, next: 0 });

/** Infected the player can see (line of sight on the walk grid) within `radius`, nearest first. */
export function visibleThreats(w: SimWorld, p: P, radius: number): EntitySnapshot[] {
  return (w.infected?.active ?? []).filter(e => e.health.current > 0 && !e.hidden && !e.infected?.hidden && !e.infectionRise && dist(e.transform, p) <= radius && w.infected!.nav.visible(p, e.transform, 0))
    .sort((a, b) => dist(a.transform, p) - dist(b.transform, p));
}
/** An infected that is chasing or biting the courier. */
export function chasingCourier(e: EntitySnapshot): boolean { const b = e.infected?.l1; return !!b && (b.mode === 'chase' || b.mode === 'bite') && b.targetId === 1; }
/** Attack `target` with the left (melee) or right (ranged) hand, standing still. */
export function strikeAt(frame: InputFrame, target: EntitySnapshot, side: 'LEFT' | 'RIGHT'): void {
  frame.attackTarget = { id: target.id, side }; frame.move = { x: 0, z: 0 };
  if (side === 'LEFT') frame.left.held = true; else frame.right.held = true;
}
/** `go(target, stop, key)`: walk toward the target on the connected route; true once within `stop` (or when no route exists). */
export function walkTo(walker: Walker, w: SimWorld, frame: InputFrame) {
  return (target: P, stop: number, key: string): boolean => { const dir = walker.step(w, target, stop, key); if (dir) frame.move = dir; return !dir; };
}
/** Medkits and sodas still lying around (the bot's `s.medkitIds` entries). */
const available = (e: EntitySnapshot | undefined): e is EntitySnapshot => !!e?.pickup && 'kind' in e.pickup && !e.pickup.collected;
/** The nearest uncollected pickup among `ids` that satisfies `accept`. */
export function nearestKit(w: SimWorld, ids: readonly number[], p: P, accept: (e: EntitySnapshot) => boolean): EntitySnapshot | undefined {
  return ids.map(id => w.entities.get(id)).filter(available).filter(accept).sort((x, y) => dist(x.transform, p) - dist(y.transform, p))[0];
}
/** The medkit the bot is walking to, or null once it is gone or the courier is healed (the caller then clears its target). */
export function heldKit(w: SimWorld, id: number, hp: number, newbie: boolean): EntitySnapshot | null {
  const kit = w.entities.get(id);
  return available(kit) && hp <= (newbie ? .99 : .95) ? kit : null;
}
/** Once a second: true after three consecutive checks without progress (a courier that is `engaged` in a fight resets the count). The caller then steps aside. */
export function jammed(stuck: Stuck, tick: number, p: P, engaged: boolean): boolean {
  if (tick < stuck.next) return false;
  stuck.next = tick + 60;
  if (stuck.at && dist(stuck.at, p) < .6 && !engaged) stuck.n++; else stuck.n = 0;
  stuck.at = { x: p.x, z: p.z };
  if (stuck.n < 3) return false;
  stuck.n = 0; return true;
}
