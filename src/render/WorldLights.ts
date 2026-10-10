import { placedLights } from '../data/placedLights';
import { visibilityPolygon } from './lighting/visibility';
export { anchorsFor, placeAnchor } from '../data/placedLights';
import { footprint, type FieldLight } from './LightField';
import type { DistrictWorld } from '../sim/world/DistrictWorld';

/** Every light anchor of the loaded layouts as a light-field footprint, built once at level assembly.
 * A light is on while its placement's power group is lit at this decay tier. Parked vehicles stay dark. */
export function layoutLights(world: DistrictWorld): FieldLight[] {
  const obstacles = world.districts.flatMap(d => d.decay.colliders.filter(c => !c.walkable).map(c => ({ min: [c.aabb.min[0] + d.origin[0], c.aabb.min[1], c.aabb.min[2] + d.origin[1]] as [number, number, number], max: [c.aabb.max[0] + d.origin[0], c.aabb.max[1], c.aabb.max[2] + d.origin[1]] as [number, number, number] }))).concat(world.boundaries);
  const lights = placedLights(world).filter(source => source.anchor.pool).map((source, index) => {
    const light = footprint({ ...source.anchor, position: source.position, direction: source.direction }, source.ground, index * 1.37);
    light.on = source.on; light.id = source.id;
    light.visibility = visibilityPolygon(light, source.anchor.range + light.radius * light.stretch, obstacles);
    return light;
  });
  // Decay fires (W3+) flicker in the field; E27 adds its own through LightField.addTransient.
  for (const f of world.fires) lights.push(footprint({ type: 'fire', color: 'light_fire', intensity: 7, range: 4 + f.radius * 2, flicker: 'fire', position: [f.x, 1.2, f.z], direction: [0, -1, 0] }, 0, lights.length * 1.37));
  return lights;
}
