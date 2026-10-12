import type { Mission } from './Mission';

type Anchored = { x: number; z: number; y?: number; radius?: number };
/**
 * World position of the active objective marker (minimap pin, tracker distance and 3D ring).
 * It is always a fixed authored anchor. L3's `l3-route` anchor is a moving guidance waypoint that
 * steers bots and the route hint (it follows the player along the path), so it is shown as the
 * fixed rendezvous ring `l3-zone` instead (PO 10-12: the marker "should just stick to the checkpoint").
 */
export function markerAnchor(mission: Pick<Mission, 'state' | 'def'> | null | undefined): Anchored | null {
  const marker = mission?.state.marker;
  if (!mission || !marker) return null;
  const key = mission.def.l3 && marker === 'l3-route' ? 'l3-zone' : marker;
  return (mission.def.anchors[key] as Anchored | undefined) ?? null;
}
