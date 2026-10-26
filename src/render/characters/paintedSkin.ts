import { attribute, varying } from 'three/tsl';
import type { Node } from 'three/webgpu';
import { characterNodes } from '../../data/survivor';

/** Infection follows the sampled skin paint, rather than the triangles that happened to sample it at export. */
export function paintedSkinMask(texel: Node<'vec4'>) {
  const parts = attribute('_parts', 'vec4');
  const exposed = varying(parts.x.equal(characterNodes.indexOf('head')).or(parts.y.equal(-1)).and(parts.z.lessThan(.5)).select(1, 0), 'paintedSkinRegion');
  const r = texel.r.max(.001), green = texel.g.div(r), blue = texel.b.div(r);
  return exposed.mul(r.smoothstep(.09, .18)).mul(green.smoothstep(.18, .3)).mul(green.smoothstep(.95, .78))
    .mul(blue.smoothstep(.06, .14)).mul(blue.smoothstep(.98, .8));
}
