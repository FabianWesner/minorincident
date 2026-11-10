import type { SimWorld } from '../../sim/world/SimWorld';
import type { EntitySnapshot } from '../../sim/world/types';

type Point = { x: number; z: number };
/** Named survivors stand a little apart, on the open apron in front of her. */
const slots = { mia: [4.2, 2.2], rosa: [5.4, -.6], dale: [6.2, 2.8], okafor: [3.6, 4.2] } as const;
/** r31-epilogue "Back to her": the courier sits on the dispersal platform steps at sunrise, the corgi's head on her knee.
 * Everything is relative to her seat at the stair foot, which faces east (+x, the sunrise and the open apron). */
export const l10Closing = {
  /** Root lift for the sit clip, so the pelvis rests on the lowest tread. */
  seatY: 0,
  seat(world: SimWorld): Point | undefined {
    const anchors = world.missions?.def.anchors, foot = anchors?.['dispersal-stair-foot'] ?? anchors?.['cure-console'];
    return foot ? { x: foot.x + .3, z: foot.z } : undefined;
  },
  /** The corgi sits against her right shin, turned to her, chin at knee height. */
  corgi(seat: Point): { x: number; z: number; yaw: number } { return { x: seat.x + .62, z: seat.z + .5, yaw: Math.PI * .5 }; },
  /** A low three-quarter view from the apron, sun behind the camera's left shoulder. */
  camera(console: Point, aspect: number, seat: Point = { x: console.x - 1.7, z: console.z - 6 }): { position: [number, number, number]; target: [number, number, number] } {
    const fit = Math.max(1, (16 / 9) / aspect), target: [number, number, number] = [seat.x + 1.6, .9, seat.z + 1.2];
    return { position: [target[0] + 7.5 * fit, 3.6 + 1.4 * fit, target[2] + 6.5 * fit], target };
  },
  /** Mega Alpha body, which the closing group must never stand in. */
  megaBody(world: SimWorld): Point | undefined {
    const id = world.megaPursuit?.state.id, e = id ? world.entities.get(id) : undefined;
    return e && e.health.current <= 0 ? e.transform : undefined;
  },
};
/** The closing shot gathers the cured near her, clear of the battle's bodies. */
export function l10ClosingPose(world: SimWorld, e: EntitySnapshot): EntitySnapshot['transform'] | undefined {
  const mission = world.missions, state = mission?.state;
  if (world.scenario !== 'L10' || !state?.epilogue || state.counters['epilogue-ticks'] < 45 * 60 || e.health.current <= 0 || e.infected) return;
  const key = e.civilian?.survivor?.key, sam = e.id === state.actors['hangar-sam'] || e.civilian?.model?.startsWith('npc.sam');
  const seat = l10Closing.seat(world), console = mission!.def.anchors['cure-console'];
  let slot: readonly number[] | undefined = key && slots[key as keyof typeof slots] || (sam ? [3, -1.8] : undefined);
  if (!slot && console && seat && state.cureFront?.affectedIds.includes(e.id) && Math.hypot(e.transform.x - console.x, e.transform.z - console.z) < 22) {
    const nearby = state.cureFront.affectedIds.filter(id => { const person = world.entities.get(id); return person?.civilian && !person.civilian.pet && person.health.current > 0 && Math.hypot(person.transform.x - console.x, person.transform.z - console.z) < 22; });
    const index = nearby.indexOf(e.id);
    if (index < 0 || index >= 12) return;
    // A loose arc on the apron, facing her; no grid.
    const angle = -1.05 + (index % 6) * .42 + (index >= 6 ? .21 : 0), radius = 6.5 + (index >= 6 ? 3 : 0) + (index % 2) * .8;
    slot = [Math.cos(angle) * radius, Math.sin(angle) * radius];
  }
  if (!slot || !seat) return;
  let x = seat.x + slot[0], z = seat.z + slot[1];
  const mega = l10Closing.megaBody(world);
  if (mega) {
    // Keep the closing group out of the Mega's body (r30 P3: a cured civilian stood inside it).
    const dx = x - mega.x, dz = z - mega.z, d = Math.hypot(dx, dz);
    if (d < 4.5) { const s = d > .01 ? 4.5 / d : 1; x = mega.x + (d > .01 ? dx : 1) * s; z = mega.z + (d > .01 ? dz : 0) * s; }
  }
  return { ...e.transform, x, y: .7, z, yaw: -Math.atan2(seat.z - z, seat.x - x) };
}
