/**
 * Street doors that story actors (L1 depot clerk, lab technician) walk through, in the asset's glTF frame: +X is the
 * front, +Y up, local z = -Blender y (see the asset build.py `door_main` empties). A placement maps them to the world
 * with the layout yaw (three.js rotation.y).
 */
export interface BuildingDoor {
  /** Door plane (local x of the hinge empties). */
  x: number;
  /** Aperture centre and clear width along local z. */
  z: number; width: number;
  /** Walking lane (local z): the aperture centre unless a leaf resting open narrows one side. */
  lane: number;
  /** Where the actor waits behind the door (local x), clear of the counter or reception desk. */
  inside: number;
  /** Front edge of the model's sidewalk dressing (local x): the actor walks straight out to it before turning, so the
   * A-frame, pots and hand truck that carry no collider stay beside the lane. */
  apron: number;
  /** Leaves the view swings open while someone is in the doorway (node name, open yaw about +Y in radians).
   * Empty when the authored rest pose is already open. */
  leaves: { node: string; open: number }[];
}

export const buildingDoors: Record<string, BuildingDoor> = {
  // Shopfront door rests open at 65 degrees (hinge at Blender y 1.35, leaf tip swung out to y 0.78): the lane keeps
  // 0.4 m off the aperture centre toward the A-frame side (A-frame at Blender y -0.70, outside the lane).
  'bld.courier-depot': { x: 1.27, z: -.675, width: 1.35, lane: -.4, inside: .9, apron: 2.75, leaves: [] },
  // Double glass doors, closed at rest; both leaves swing outward (pose test: door_main -60, door_main_right +60 deg).
  // The technician waits 1.58 m behind the door (L1 lab-tech-spawn), outside the opening zone, so the doors stay shut.
  'bld.clinic-annex': { x: 2.53, z: -.18, width: 1.8, lane: -.18, inside: .95, apron: 3.3, leaves: [{ node: 'door_main', open: -1.31 }, { node: 'door_main_right', open: 1.31 }] },
};

/** Asset-local (x, z) to world for a placement (same transform as the instanced static view). */
export function placeLocal(p: { position: readonly number[]; yaw: number; scale: readonly number[] }, lx: number, lz: number, origin: readonly number[] = [0, 0]): { x: number; z: number } {
  const x = lx * p.scale[0], z = lz * p.scale[2], c = Math.cos(p.yaw), s = Math.sin(p.yaw);
  return { x: p.position[0] + origin[0] + x * c + z * s, z: p.position[2] + origin[1] - x * s + z * c };
}

/** Doorway in world space: the point on the door plane, the outward unit normal and the point behind the door. */
export interface Doorway { assetId: string; door: { x: number; z: number }; inside: { x: number; z: number }; /** Straight-out distance from the door plane before the route may turn. */ apron: number; out: { x: number; z: number }; centre: { x: number; z: number }; width: number }
export function doorwayOf(p: { assetId: string; position: readonly number[]; yaw: number; scale: readonly number[] }, origin: readonly number[] = [0, 0]): Doorway | null {
  const d = buildingDoors[p.assetId]; if (!d) return null;
  const door = placeLocal(p, d.x, d.lane, origin), inside = placeLocal(p, d.inside, d.lane, origin), centre = placeLocal(p, d.x, d.z, origin);
  return { assetId: p.assetId, door, inside, centre, apron: (d.apron - d.x) * p.scale[0], out: { x: Math.cos(p.yaw), z: -Math.sin(p.yaw) }, width: d.width * p.scale[2] };
}

/** Seconds for a leaf to swing fully open (or shut). */
export const doorSwingS = .4;
/** The doorway zone that opens the door: up to 1.1 m behind the door plane, 2.3 m in front (a walker reaches the leaf sweep after the 0.4 s swing), the aperture plus 0.35 m. */
export function doorZone(way: Doorway, p: { x: number; z: number }): boolean {
  const along = (p.x - way.centre.x) * way.out.x + (p.z - way.centre.z) * way.out.z, lateral = (p.x - way.centre.x) * -way.out.z + (p.z - way.centre.z) * way.out.x;
  return along > -1.1 && along < 2.3 && Math.abs(lateral) < way.width / 2 + .35;
}
/** A body in the door aperture or in the sweep of the outward-swinging leaves (where a shut or swinging leaf would cut it). */
export function inDoorway(way: Doorway, p: { x: number; z: number }, radius = .3): boolean {
  const along = (p.x - way.centre.x) * way.out.x + (p.z - way.centre.z) * way.out.z, lateral = (p.x - way.centre.x) * -way.out.z + (p.z - way.centre.z) * way.out.x;
  return along > -radius - .1 && along < way.width / 2 + radius && Math.abs(lateral) < way.width / 2;
}
