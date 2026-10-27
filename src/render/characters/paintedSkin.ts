import type { Node } from 'three/webgpu';
import { crowdPaintedSkinRegion } from './CrowdAppearance';

/** Infection follows the sampled skin paint, rather than the triangles that happened to sample it at export. */
export function paintedSkinMask(texel: Node<'vec4'>) {
  const exposed = crowdPaintedSkinRegion();
  const r = texel.r.max(.001), green = texel.g.div(r), blue = texel.b.div(r);
  return exposed.mul(r.smoothstep(.09, .18)).mul(green.smoothstep(.18, .3)).mul(green.smoothstep(.95, .78))
    .mul(blue.smoothstep(.06, .14)).mul(blue.smoothstep(.98, .8));
}
