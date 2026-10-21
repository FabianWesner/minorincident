import type { Mission } from './Mission';

type Anchored = { x: number; z: number; y?: number; radius?: number };
/** Outer edge of the objective torus, including its tube. Completion discs cover this whole area. */
export const objectiveRingRadius = .65;

/** L5 search cues share the same visible, clickable destination as their discovery test. */
export function searchAnchors(mission: Pick<Mission, 'state' | 'def'> | null | undefined): Anchored[] {
  const s = mission?.state.l5;
  return mission && s && (s.phase === 'search' || s.phase === 'metro')
    ? s.survivors.filter(r => r.status === 'hidden').map(r => mission.def.anchors[`l5-ring-${r.key}`]) : [];
}
/**
 * World position shared by the minimap pin, tracker distance, diamond and 3D ring.
 * L3's `l3-route` anchor is a moving guidance waypoint that
 * steers bots and the route hint (it follows the player along the path), so it is shown as the
 * fixed rendezvous ring `l3-zone` instead (PO 10-12: the marker "should just stick to the checkpoint").
 */
export function markerAnchor(mission: Pick<Mission, 'state' | 'def'> | null | undefined): Anchored | null {
  const marker = mission?.state.marker;
  if (!mission || !marker) return null;
  const key = mission.def.l3 && marker === 'l3-route' ? 'l3-zone' : marker;
  return (mission.def.anchors[key] as Anchored | undefined) ?? null;
}
