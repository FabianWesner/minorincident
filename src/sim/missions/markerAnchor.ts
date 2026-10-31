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
 * L3 uses its next open route waypoint so every HUD surface guides the player
 * around street closures instead of bearing straight through them.
 */
export function markerAnchor(mission: Pick<Mission, 'state' | 'def'> | null | undefined): Anchored | null {
  const marker = mission?.state.marker;
  if (!mission || !marker) return null;
  return (mission.def.anchors[marker] as Anchored | undefined) ?? null;
}
