import type { Node, TextureNode } from 'three/webgpu';
import { float, int, luminance, mix, vec2 } from 'three/tsl';
import { crowdRegionColours } from './CrowdAppearance';
import { crowdRegion, crowdRegionLegacy, crowdRegionLuminance } from './crowdRegionData';

/** The texel's region class, read at the texel centre of the base level: a filtered alpha would blend two classes
 * into a third. A sampled read (not textureLoad) shares the colour's binding; a load beside it blanked the WebGPU sample. */
export function crowdRegionOf(atlas: TextureNode, uv: Node<'vec2'>): Node<'float'> {
  const size = vec2(atlas.size(int(0)) as unknown as Node<'ivec2'>);
  return atlas.sample(uv.mul(size).floor().add(.5).div(size)).level(float(0)).a.mul(7).round().sub(1);
}
/** Hair, skin, shirt and trousers take the person's tones; the paint's luminance (normalised at build) keeps its shading. */
export function crowdRegionTint(rgb: Node<'vec3'>, region: Node<'float'>, infected = false): Node<'vec3'> {
  const tones = crowdRegionColours(infected), L = crowdRegionLuminance;
  const tone = region.equal(crowdRegion.hair).select(tones.hair, region.equal(crowdRegion.skin).select(tones.skin, region.equal(crowdRegion.shirt).select(tones.shirt, tones.trousers)));
  const reference = region.equal(crowdRegion.hair).select(L.hair, region.equal(crowdRegion.skin).select(L.skin, region.equal(crowdRegion.shirt).select(L.shirt, L.trousers)));
  return mix(rgb, tone.mul(luminance(rgb).div(reference).clamp(.5, 1.7)), region.lessThan(crowdRegion.trousers + .5).select(1, 0));
}
/** Skin for the infection blend: classed atlases name it; legacy atlases fall back to the painted-skin estimate. */
export function crowdRegionSkin(region: Node<'float'>, legacy: () => Node<'float'>): Node<'float'> {
  return region.equal(crowdRegionLegacy).select(legacy(), region.equal(crowdRegion.skin).or(region.equal(crowdRegion.skinMask)).select(1, 0));
}
