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
 * L3 uses its next open route waypoint so navigation markers guide the player
 * around street closures instead of bearing straight through them.
 */
export function markerAnchor(mission: (Pick<Mission, 'state' | 'def'> & { world?: Mission['world']; l8?: Mission['l8']; l9?: Mission['l9'] }) | null | undefined): Anchored | null {
  // L10 final fight (r29-l10mega, PO finding: 'Kill the Mega Alpha' ran for minutes with no direction): the 'mega' step
  // has no authored waypoint, so while it is active the guidance follows the live Mega (HUD distance, edge arrow, minimap pin).
  if (mission?.def.id === 'L10' && mission.state.steps.mega?.status === 'active' && mission.world?.megaPursuit?.alive()) {
    const mega = mission.world.megaPursuit.entity();
    if (mega) return { x: mega.transform.x, z: mega.transform.z, y: mega.transform.y, radius: 2 };
  }
  // r31-nadia (PO: 'she is just running away ... I don't know which way to go'): while Nadia leads, guidance follows Nadia herself; at the plaza it is the ring.
  if (mission?.def.id === 'L8' && mission.l8 && mission.world && mission.state.steps.sanctuary?.status === 'active' && mission.l8.state.guideDone === 0) {
    const nadia = mission.world.entities.get(mission.l8.state.keeperId);
    if (nadia) return { x: nadia.transform.x, z: nadia.transform.z, y: nadia.transform.y, radius: 2 };
  }
  // r39-markers (r38-vqa P2: 'the marker sits at the bridge gate, behind the trigger'): while L9 drives, the ring is where the next
  // trigger fires: the evacuation bay until the survivors are aboard, then the middle of the bridge deck (the collapse needs the
  // hull anywhere on the deck, any speed). The static authored anchor (x 470, the bridge-gate wall) stays only as the fallback.
  if (mission?.def.id === 'L9' && mission.l9?.state.phase === 'driving') {
    const drv = mission.l9.driving.state, b = l9Course.bridge, e = l9Course.evacuation, g = l9Course.gate;
    // r42-l9pin follow-up: with the gate shut the straight line to the bay ran into the gate; the marker-following APC sat against it
    // for 400 s (native seed 2). West of the gate the ring is the side-fence gap nearest the hull ("ram the side fence").
    const car = mission.world?.entities.get(mission.l9.state.carId)?.transform;
    if (drv.gateClosed && drv.evacuationAt === null && car && car.x < g.x + 2 && car.x > g.x - 60 && Math.abs(car.z) < g.sideZ + 25)
      return { x: g.x + 4, z: (car.z < 0 ? -1 : 1) * g.sideZ, radius: 3 };
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
  // Older L10 resumes retain this marker. Never expose the private pursuit
  // anchor through a world ring, HUD arrow or minimap destination pin.
  if (mission.def.id === 'L10' && marker === 'cure-mega') return null;
  return (mission.def.anchors[marker] as Anchored | undefined) ?? null;
}
