import type { Mission } from './Mission';
import { cureWeaponPickups } from '../../levels/L10/encounters';

type Anchored = { x: number; z: number; y?: number; radius?: number };
/** Outer edge of the objective torus, including its tube. Completion discs cover this whole area. */
export const objectiveRingRadius = .65;

/**
 * World position shared by the minimap pin, diamond and 3D ring.
 * L3 uses its next open route waypoint so navigation markers guide the player
 * around street closures instead of bearing straight through them.
 */
export function markerAnchor(mission: (Pick<Mission, 'state' | 'def'> & { world?: Mission['world']; l8?: Mission['l8'] }) | null | undefined): Anchored | null {
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
