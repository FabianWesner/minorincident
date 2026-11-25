import type { Mission } from './Mission';
import { cureWeaponPickups } from '../../levels/L10/encounters';
import { l5 as l5Rescue } from '../../data/l5';
import { l9Course } from '../../data/l9';
// (l5Rescue.firstRescue.route is the survivor order of the first rescue)

type Anchored = { x: number; z: number; y?: number; radius?: number };
/** Outer edge of the objective torus, including its tube. Completion discs cover this whole area. */
export const objectiveRingRadius = .65;

/**
 * World position shared by the minimap pin, diamond and 3D ring.
 * Destination marker for the current objective. Route steering is separate;
 * this anchor must not depend on the player's position.
 */
export function markerAnchor(mission: (Pick<Mission, 'state' | 'def'> & { world?: Mission['world']; l4?: Mission['l4']; l8?: Mission['l8']; l9?: Mission['l9'] }) | null | undefined): Anchored | null {
  // L4's street routing may steer around closed streets, but the visible
  // destination remains the cellar door for the whole escape objective.
  if (mission?.def.id === 'L4' && mission.world && mission.state.steps.hide?.status === 'active') {
    const door = mission.def.anchors['l4-cellar-door'];
    if (door) return door;
  }
  if (mission?.def.id === 'L10' && mission.state.steps.mega?.status === 'active')
    return mission.def.anchors['cure-console'] ?? null;
  // L9 chooses one fixed destination for each driving sub-objective. This
  // changes only when the evacuation stage completes.
  if (mission?.def.id === 'L9' && mission.l9?.state.phase === 'driving') {
    const drv = mission.l9.driving.state, b = l9Course.bridge, e = l9Course.evacuation;
    return drv.evacuationDone ? { x: (b.x + b.endX) / 2, z: 0, radius: b.halfZ } : { x: e.x, z: e.z, radius: e.radius - 2 };
  }
  // r34-l8qa (r33-vqa: 'After she joins, nothing points to the church'): L5's search spots are unmarked (found by sound), but once the
  // first survivor follows, guidance points at the next one on the first-rescue route (Mr. Okafor in the church) until he is found.
  if (mission?.def.id === 'L5' && mission.state.steps.look?.status === 'active') {
    const l5 = mission.state.l5, [first, next] = l5Rescue.firstRescue.route;
    if (l5 && first && next && l5.survivors.find(r => r.key === first)?.status === 'following' && l5.survivors.find(r => r.key === next)?.status === 'hidden') {
      const ring = mission.def.anchors[`l5-ring-${next}`] as Anchored | undefined;
      if (ring) return ring;
    }
    // r36-l9l5 (r35-vqa: 'still nothing points the player to Mia ... the marker-following courier stood at the cellar exit for 5 minutes'):
    // before anyone is found, guidance points at the first survivor on the route (Mia), so the opening search has a direction.
    if (l5 && first && l5.survivors.find(r => r.key === first)?.status === 'hidden' && !l5.survivors.some(r => r.status !== 'hidden')) {
      const ring = mission.def.anchors[`l5-ring-${first}`] as Anchored | undefined;
      if (ring) return ring;
    }
  }
  const marker = mission?.state.marker;
  if (!mission || !marker) return null;
  if (mission.def.id === 'L10') {
    const farm = mission.state.steps.farmstead?.status === 'active';
    const restricted = mission.state.steps['restricted-zone']?.status === 'active';
    const next = (farm ? cureWeaponPickups.slice(0, 4) : restricted ? cureWeaponPickups.slice(4) : [])
      .find(p => !mission.state.states[`found-${p.id}`]);
    if (next && mission.def.anchors[next.anchor]) return mission.def.anchors[next.anchor];
  }
  // The Mega is a combat target, not a destination. Keep the ring at the
  // dispersal console if a current or legacy objective marker names it.
  if (mission.def.id === 'L10' && marker === 'cure-mega') return mission.def.anchors['cure-console'] ?? null;
  return (mission.def.anchors[marker] as Anchored | undefined) ?? null;
}
