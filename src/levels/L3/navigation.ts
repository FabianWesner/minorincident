import type { SimWorld } from '../../sim/world/SimWorld';
export function l3RouteDirection(world: SimWorld, route: {path:number[];goal:number;pathIndex:number}, waypoint: {x:number;z:number}): boolean {
  const mission = world.missions, player = world.entities.get(1);
  if (!mission?.def.l3 || !player || !world.infected) return false;
  return world.infected.nav.steer(player.transform, mission.def.anchors['l3-zone'], route, .45, waypoint, Infinity, true);
}
