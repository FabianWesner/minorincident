import { Vector2 } from 'three';
import type { Node } from 'three/webgpu';
import { uniform, positionWorld, vec3, mix } from 'three/tsl';
/** One shared field tints terrain, wrecks and bodies behind the green tide without another draw pass. */
export const cureDust = { origin: uniform(new Vector2()), radius: uniform(-1), cinematic: uniform(0) };
export function dustSurface(base: Node<'vec3'>) {
  const feather = cureDust.cinematic.mul(160).add(3);
  const inside = cureDust.radius.sub(positionWorld.xz.distance(cureDust.origin)).smoothstep(feather.negate(), feather).mul(cureDust.radius.greaterThanEqual(0).select(1, 0));
  return mix(base, base.mul(vec3(.72, 1.15, .68)).add(vec3(.015, .06, .008)), inside.mul(.45));
}
