import { worldAssets } from '../../assets/worldDefinitions';
import { vehicleDef } from '../../data/vehicles';
import { l2TruckPath } from '../../data/l2';
import { l4, l4Route, l4RoutePose, l4ConvoyStations } from '../../data/l4';
import type { Vec2 } from '../../input/InputFrame';
import type { SimWorld } from '../world/SimWorld';

export const pickupFootprint = .45;
interface Hull { x: number; z: number; yaw: number; length: number; width: number }
const route = l4Route(), stations = l4ConvoyStations(route.length);
const l4Stops: Hull[] = l4.convoy.vehicles.map((v, i) => ({ ...l4RoutePose(route, stations.start[i] + stations.travel), length: v.len, width: v.wid }));
/** Reserve the travel corridor as well as every stop: no pack can appear in a passing wheel. */
const l4Lane: Hull[] = Array.from({ length: Math.ceil(route.length / 2) + 1 }, (_, i) => ({ ...l4RoutePose(route, Math.min(route.length, i * 2)), length: 3, width: 4 }));
const truck = vehicleDef('vehicle.fire-engine');
const l2Lane: Hull[] = l2TruckPath.filter((_, i) => i % 4 === 0).map(p => ({ x: p.x, z: p.z, yaw: p.yaw, length: truck.length, width: truck.width }));
const l2End = l2TruckPath.at(-1)!;
l2Lane.push({ ...l2End, length: truck.length, width: truck.width });
function overlaps(p: Vec2, h: Hull, radius: number): boolean {
  const dx = p.x - h.x, dz = p.z - h.z, c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  return Math.hypot(Math.max(0, Math.abs(dx * c - dz * s) - h.length / 2), Math.max(0, Math.abs(dx * s + dz * c) - h.width / 2)) < radius;
}
/** Shared placement check, including scripted convoy stop poses which have no physics vehicle. */
export function pickupPlacementClear(world: SimWorld, at: Vec2, radius = pickupFootprint): boolean {
  if (world.infected && !world.infected.nav.clear(at.x, at.z, radius)) return false;
  if (world.trapRescue && !world.trapRescue.reachable(at.x, at.z)) return false;
  for (const car of world.vehicles?.cars.values() ?? []) {
    const t = car.entity.transform, d = car.physics.def;
    if (overlaps(at, { ...t, length: d.length, width: d.width }, radius + .3)) return false;
  }
  for (const e of world.entities.iterate()) {
    if (e.kind !== 'setpiece' || !e.archetype.startsWith('veh.') || e.hidden || e.transform.y > 4) continue;
    const d = worldAssets[e.archetype]?.dimensions;
    if (d && overlaps(at, { ...e.transform, length: d.x, width: d.z }, radius + .3)) return false;
  }
  const level = world.missions?.state.id ?? world.districts?.composition.id;
  if (level === 'L4') {
    if ([...l4Stops, ...l4Lane].some(h => overlaps(at, h, radius + .5))) return false;
    const fuel = worldAssets['veh.fuel-truck'].dimensions, tank = worldAssets['veh.tank'].dimensions, end = l4.tank.path.at(-1)!;
    if (overlaps(at, { ...l4.fuelTruck, length: fuel.x, width: fuel.z }, radius + .3) || overlaps(at, { x: end[0], z: end[1], yaw: Math.PI / 2, length: tank.x, width: tank.z }, radius + .3)) return false;
  }
  if (level === 'L2' && l2Lane.some(h => overlaps(at, h, radius + .3))) return false;
  return true;
}
/** Deterministic nearest clear pavement. Runs at spawn, never every frame or on collected packs. */
export function clearPickupPosition(world: SimWorld, at: Vec2): Vec2 {
  if (!world.districts || pickupPlacementClear(world, at)) return at;
  for (let d = .5; d <= 16; d += .5) for (let k = 0; k < 32; k++) {
    const p = { x: at.x + Math.cos(k * Math.PI / 16) * d, z: at.z + Math.sin(k * Math.PI / 16) * d };
    if (pickupPlacementClear(world, p)) return p;
  }
  throw new Error(`No clear pickup placement near (${at.x}, ${at.z}) in ${world.districts.composition.id}`);
}
